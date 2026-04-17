const redis = require("../../lib/redis");
const crypto = require("crypto");

const CRASH_STATE_KEY = "crash:round:state";
const CRASH_FAIR_STATE_KEY = "crash:round:fair";

const CRASH_EVENTS = {
  TICK: "crash_tick",
  START: "crash_start",
  END: "crash_end",
  SEED_HASH: "crash_seed_hash",
  SEED_REVEAL: "crash_seed_reveal",
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
  defaultClientSeed: "stake-clone-client-seed",
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

    this.currentFairState = {
      roundId: null,
      serverSeed: null,
      serverSeedHash: null,
      clientSeed: this.options.defaultClientSeed,
      nonce: 0,
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

    await this.hydrateFairState();
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
    const fairRound = await this.createRoundFairState(roundId);
    const crashPoint = this.generateCrashPointFromFairState(fairRound);

    await this.persistState({
      roundId,
      multiplier: 1,
      crashPoint,
      status: ROUND_STATUS.WAITING,
      updatedAt: Date.now(),
    });

    this.emit(CRASH_EVENTS.SEED_HASH, {
      roundId,
      nonce: fairRound.nonce,
      clientSeed: fairRound.clientSeed,
      serverSeedHash: fairRound.serverSeedHash,
      status: ROUND_STATUS.WAITING,
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

            const fairState = await this.getFairState();
            if (fairState?.roundId === roundId && fairState?.serverSeed) {
              this.emit(CRASH_EVENTS.SEED_REVEAL, {
                roundId,
                nonce: fairState.nonce,
                clientSeed: fairState.clientSeed,
                serverSeed: fairState.serverSeed,
                serverSeedHash: fairState.serverSeedHash,
              });
            }

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

  generateCrashPointFromFairState(fairState) {
    const { minCrashPoint, maxCrashPoint } = this.options;
    const message = `${fairState.clientSeed}:${fairState.nonce}`;
    const hmacHex = crypto
      .createHmac("sha256", fairState.serverSeed)
      .update(message)
      .digest("hex");

    // Use first 52 bits so conversion stays inside JS safe integer precision.
    const slice = hmacHex.slice(0, 13);
    const hashInt = parseInt(slice, 16);
    const maxInt = 0x1fffffffffffff;
    const ratio = hashInt / maxInt;

    const crashPoint = minCrashPoint + ratio * (maxCrashPoint - minCrashPoint);
    return roundToTwo(crashPoint);
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

  async hydrateFairState() {
    try {
      const fromRedis = await redis.get(CRASH_FAIR_STATE_KEY);
      if (!fromRedis) {
        return;
      }

      const parsed = JSON.parse(fromRedis);
      if (typeof parsed?.nonce === "number" && Number.isFinite(parsed.nonce)) {
        this.currentFairState = {
          ...this.currentFairState,
          ...parsed,
          nonce: Math.max(0, Math.trunc(parsed.nonce)),
        };
      }
    } catch (error) {
      // fallback to in-memory defaults
    }
  }

  async getFairState() {
    try {
      const fromRedis = await redis.get(CRASH_FAIR_STATE_KEY);
      if (!fromRedis) {
        return this.currentFairState;
      }

      const parsed = JSON.parse(fromRedis);
      this.currentFairState = {
        ...this.currentFairState,
        ...parsed,
      };

      return this.currentFairState;
    } catch (error) {
      return this.currentFairState;
    }
  }

  async createRoundFairState(roundId) {
    const nextNonce = Number(this.currentFairState?.nonce || 0) + 1;
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");

    const fairState = {
      roundId,
      serverSeed,
      serverSeedHash,
      clientSeed: this.options.defaultClientSeed,
      nonce: nextNonce,
      updatedAt: Date.now(),
    };

    this.currentFairState = fairState;

    try {
      await redis.set(CRASH_FAIR_STATE_KEY, JSON.stringify(fairState));
    } catch (error) {
      // fallback to in-memory state only
    }

    return fairState;
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
