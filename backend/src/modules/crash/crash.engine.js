const redis = require("../../lib/redis");

const CRASH_STATE_KEY = "crash:round:state";

const CRASH_EVENTS = {
  TICK: "crash_tick",
  START: "crash_start",
  END: "crash_end",
};

const ROUND_STATUS = {
  WAITING: "waiting",
  RUNNING: "running",
  CRASHED: "crashed",
};

const DEFAULTS = {
  startDelayMs: 3000,
  tickIntervalMs: 100,
  minCrashPoint: 1.2,
  maxCrashPoint: 10,
  growthRate: 0.01, // ~1% per tick exponential growth
};

const roundToTwo = (value) => Math.round(value * 100) / 100;

class CrashEngine {
  constructor(io, options = {}) {
    this.io = io;
    this.options = {
      ...DEFAULTS,
      ...options,
    };

    this.isStarted = false;
    this.roundCounter = 0;
    this.tickIntervalId = null;
    this.hooks = {
      onRoundStart: null,
      onRoundCrash: null,
    };
    this.currentState = {
      roundId: null,
      multiplier: 1,
      crashPoint: null,
      status: ROUND_STATUS.WAITING,
      updatedAt: Date.now(),
    };
  }

  setIo(io) {
    this.io = io;
  }

  async start() {
    if (this.isStarted) {
      return false;
    }

    this.isStarted = true;
    this.runLoop().catch((error) => {
      console.error("[crash-engine] loop stopped unexpectedly:", error.message);
      this.isStarted = false;
      this.clearTickInterval();
    });

    return true;
  }

  setHooks(hooks = {}) {
    this.hooks = {
      ...this.hooks,
      ...hooks,
    };
  }

  async getState() {
    try {
      const fromRedis = await redis.get(CRASH_STATE_KEY);
      if (!fromRedis) {
        return this.currentState;
      }

      const parsed = JSON.parse(fromRedis);
      this.currentState = {
        ...this.currentState,
        ...parsed,
      };

      return this.currentState;
    } catch (error) {
      return this.currentState;
    }
  }

  async runLoop() {
    while (this.isStarted) {
      await this.runSingleRound();
    }
  }

  async runSingleRound() {
    const roundId = `${Date.now()}-${++this.roundCounter}`;
    const crashPoint = this.generateCrashPoint();

    await this.persistState({
      roundId,
      multiplier: 1,
      crashPoint,
      status: ROUND_STATUS.WAITING,
      updatedAt: Date.now(),
    });

    await this.wait(this.options.startDelayMs);
    if (!this.isStarted) {
      return;
    }

    await this.persistState({
      roundId,
      multiplier: 1,
      crashPoint,
      status: ROUND_STATUS.RUNNING,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.emit(CRASH_EVENTS.START, {
      roundId,
      multiplier: 1,
      status: ROUND_STATUS.RUNNING,
    });

    await this.runHook("onRoundStart", {
      roundId,
      multiplier: 1,
      crashPoint,
      status: ROUND_STATUS.RUNNING,
    });

    await this.runTickLoop(roundId, crashPoint);
  }

  runTickLoop(roundId, crashPoint) {
    return new Promise((resolve) => {
      this.clearTickInterval();
      let multiplier = 1;
      let tickInProgress = false;

      this.tickIntervalId = setInterval(async () => {
        if (tickInProgress) {
          return;
        }

        tickInProgress = true;

        try {
          if (!this.isStarted) {
            this.clearTickInterval();
            tickInProgress = false;
            resolve();
            return;
          }

          multiplier = this.nextMultiplier(multiplier);

          if (multiplier >= crashPoint) {
            multiplier = crashPoint;
            this.clearTickInterval();

            await this.persistState({
              roundId,
              multiplier,
              crashPoint,
              status: ROUND_STATUS.CRASHED,
              crashedAt: Date.now(),
              updatedAt: Date.now(),
            });

            this.emit(CRASH_EVENTS.END, {
              roundId,
              multiplier,
              status: ROUND_STATUS.CRASHED,
            });

            await this.runHook("onRoundCrash", {
              roundId,
              multiplier,
              crashPoint,
              status: ROUND_STATUS.CRASHED,
            });

            tickInProgress = false;
            resolve();
            return;
          }

          await this.persistState({
            roundId,
            multiplier,
            crashPoint,
            status: ROUND_STATUS.RUNNING,
            updatedAt: Date.now(),
          });

          this.emit(CRASH_EVENTS.TICK, {
            roundId,
            multiplier,
            status: ROUND_STATUS.RUNNING,
          });

          tickInProgress = false;
        } catch (error) {
          console.error("[crash-engine] tick error:", error.message);
          tickInProgress = false;
        }
      }, this.options.tickIntervalMs);
    });
  }

  nextMultiplier(current) {
    const growthRate = this.options.growthRate;
    return roundToTwo(current * (1 + growthRate));
  }

  generateCrashPoint() {
    const { minCrashPoint, maxCrashPoint } = this.options;
    const random = minCrashPoint + Math.random() * (maxCrashPoint - minCrashPoint);
    return roundToTwo(random);
  }

  emit(event, payload) {
    if (!this.io) {
      return;
    }

    this.io.emit(event, payload);
  }

  async persistState(nextState) {
    const normalized = {
      ...this.currentState,
      ...nextState,
      multiplier: roundToTwo(Number(nextState.multiplier ?? this.currentState.multiplier ?? 1)),
      crashPoint: roundToTwo(Number(nextState.crashPoint ?? this.currentState.crashPoint ?? 1.2)),
    };

    this.currentState = normalized;

    try {
      await redis.set(CRASH_STATE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // keep in-memory state as fallback even if Redis fails
    }
  }

  clearTickInterval() {
    if (!this.tickIntervalId) {
      return;
    }

    clearInterval(this.tickIntervalId);
    this.tickIntervalId = null;
  }

  wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async runHook(hookName, payload) {
    const hook = this.hooks?.[hookName];
    if (typeof hook !== "function") {
      return;
    }

    try {
      await hook(payload);
    } catch (error) {
      console.error(`[crash-engine] hook ${hookName} failed:`, error.message);
    }
  }
}

let crashEngineInstance = null;

const getCrashEngine = (io = null) => {
  if (!crashEngineInstance) {
    crashEngineInstance = new CrashEngine(io);
  } else if (io) {
    crashEngineInstance.setIo(io);
  }

  return crashEngineInstance;
};

module.exports = {
  CRASH_EVENTS,
  ROUND_STATUS,
  getCrashEngine,
};
