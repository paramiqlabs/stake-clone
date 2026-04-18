const redis = require("../../lib/redis");
const crypto = require("crypto");

const CRASH_CURRENT_ROUND_KEY = "crash:current_round";

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
    this.lastNonce = 0;
    this.recoveredWaitingRound = null;
    this.hooks = {
      onRoundStart: null,
      onRoundCrash: null,
    };
    this.currentState = {
      roundId: null,
      multiplier: 1,
      crashPoint: null,
      serverSeed: null,
      serverSeedHash: null,
      clientSeed: this.options.defaultClientSeed,
      nonce: 0,
      startedAt: null,
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

    await this.hydrateCurrentRoundState();
    await this.recoverRoundOnStartup();
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
      const fromRedis = await redis.get(CRASH_CURRENT_ROUND_KEY);
      if (!fromRedis) {
        return this.currentState;
      }

      const parsed = JSON.parse(fromRedis);
      this.currentState = {
        ...this.currentState,
        ...this.normalizeRoundState(parsed),
      };

      return this.currentState;
    } catch (error) {
      return this.currentState;
    }
  }

  async runLoop() {
    while (this.isStarted) {
      const recoveredRound = this.recoveredWaitingRound;
      this.recoveredWaitingRound = null;
      await this.runSingleRound(recoveredRound);
    }
  }

  async runSingleRound(recoveredRound = null) {
    const roundContext = recoveredRound || this.createNewRoundContext();
    await this.persistState(roundContext);

    this.emit(CRASH_EVENTS.SEED_HASH, {
      roundId: roundContext.roundId,
      nonce: roundContext.nonce,
      clientSeed: roundContext.clientSeed,
      serverSeedHash: roundContext.serverSeedHash,
      status: ROUND_STATUS.WAITING,
      recovered: Boolean(recoveredRound),
    });

    await this.wait(this.options.startDelayMs);
    if (!this.isStarted) {
      return;
    }

    await this.persistState({
      roundId: roundContext.roundId,
      multiplier: 1,
      crashPoint: roundContext.crashPoint,
      serverSeed: roundContext.serverSeed,
      serverSeedHash: roundContext.serverSeedHash,
      clientSeed: roundContext.clientSeed,
      nonce: roundContext.nonce,
      status: ROUND_STATUS.RUNNING,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.emit(CRASH_EVENTS.START, {
      roundId: roundContext.roundId,
      multiplier: 1,
      status: ROUND_STATUS.RUNNING,
    });

    await this.runHook("onRoundStart", {
      roundId: roundContext.roundId,
      multiplier: 1,
      crashPoint: roundContext.crashPoint,
      status: ROUND_STATUS.RUNNING,
    });

    await this.runTickLoop(roundContext.roundId, roundContext.crashPoint);
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

            const roundState = await this.getState();
            if (roundState?.roundId === roundId && roundState?.serverSeed) {
              this.emit(CRASH_EVENTS.SEED_REVEAL, {
                roundId,
                nonce: roundState.nonce,
                clientSeed: roundState.clientSeed,
                serverSeed: roundState.serverSeed,
                serverSeedHash: roundState.serverSeedHash,
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

  generateCrashPointFromRound(roundState) {
    const { minCrashPoint, maxCrashPoint } = this.options;
    const message = `${roundState.clientSeed}:${roundState.nonce}`;
    const hmacHex = crypto
      .createHmac("sha256", roundState.serverSeed)
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
    const normalized = this.normalizeRoundState({
      ...this.currentState,
      ...nextState,
    });

    this.currentState = normalized;

    try {
      await redis.set(CRASH_CURRENT_ROUND_KEY, JSON.stringify(normalized));
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

  async hydrateCurrentRoundState() {
    try {
      const fromRedis = await redis.get(CRASH_CURRENT_ROUND_KEY);
      if (!fromRedis) {
        return;
      }

      const parsed = JSON.parse(fromRedis);
      this.currentState = this.normalizeRoundState({
        ...this.currentState,
        ...parsed,
      });
      this.lastNonce = Math.max(0, Number(this.currentState.nonce) || 0);
    } catch (error) {
      // fallback to in-memory defaults
    }
  }

  createNewRoundContext() {
    const roundId = `${Date.now()}-${++this.roundCounter}`;
    const nextNonce = this.lastNonce + 1;
    const serverSeed = crypto.randomBytes(32).toString("hex");
    const serverSeedHash = crypto.createHash("sha256").update(serverSeed).digest("hex");
    const clientSeed = this.options.defaultClientSeed;

    const roundContext = this.normalizeRoundState({
      roundId,
      multiplier: 1,
      crashPoint: 1.2,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: nextNonce,
      startedAt: Date.now(),
      status: ROUND_STATUS.WAITING,
      updatedAt: Date.now(),
    });

    roundContext.crashPoint = this.generateCrashPointFromRound(roundContext);
    this.lastNonce = nextNonce;
    return roundContext;
  }

  normalizeRoundState(state) {
    const normalizedNonce = Math.max(0, Math.trunc(Number(state?.nonce ?? 0) || 0));

    return {
      ...this.currentState,
      ...state,
      status: [ROUND_STATUS.WAITING, ROUND_STATUS.RUNNING, ROUND_STATUS.CRASHED].includes(state?.status)
        ? state.status
        : this.currentState.status,
      multiplier: roundToTwo(Number(state?.multiplier ?? this.currentState.multiplier ?? 1)),
      crashPoint: roundToTwo(Number(state?.crashPoint ?? this.currentState.crashPoint ?? 1.2)),
      serverSeed: state?.serverSeed ?? this.currentState.serverSeed ?? null,
      serverSeedHash: state?.serverSeedHash ?? this.currentState.serverSeedHash ?? null,
      clientSeed: state?.clientSeed || this.currentState.clientSeed || this.options.defaultClientSeed,
      nonce: normalizedNonce,
      startedAt: typeof state?.startedAt === "number" ? state.startedAt : this.currentState.startedAt ?? null,
      updatedAt: typeof state?.updatedAt === "number" ? state.updatedAt : Date.now(),
    };
  }

  async recoverRoundOnStartup() {
    const state = await this.getState();
    if (!state?.roundId) {
      return;
    }

    this.lastNonce = Math.max(this.lastNonce, Number(state.nonce) || 0);

    if (state.status === ROUND_STATUS.RUNNING) {
      const recoveredMultiplier = state.crashPoint || state.multiplier || 1;
      const recoveredState = this.normalizeRoundState({
        ...state,
        status: ROUND_STATUS.CRASHED,
        multiplier: recoveredMultiplier,
        crashedAt: Date.now(),
        updatedAt: Date.now(),
      });

      await this.persistState(recoveredState);

      this.emit(CRASH_EVENTS.END, {
        roundId: recoveredState.roundId,
        multiplier: recoveredState.multiplier,
        status: ROUND_STATUS.CRASHED,
        recovered: true,
      });

      if (recoveredState.serverSeed) {
        this.emit(CRASH_EVENTS.SEED_REVEAL, {
          roundId: recoveredState.roundId,
          nonce: recoveredState.nonce,
          clientSeed: recoveredState.clientSeed,
          serverSeed: recoveredState.serverSeed,
          serverSeedHash: recoveredState.serverSeedHash,
          recovered: true,
        });
      }

      await this.runHook("onRoundCrash", {
        roundId: recoveredState.roundId,
        multiplier: recoveredState.multiplier,
        crashPoint: recoveredState.crashPoint,
        status: ROUND_STATUS.CRASHED,
        recovered: true,
      });
      return;
    }

    if (state.status === ROUND_STATUS.WAITING) {
      const hasRecoverableFairState =
        typeof state.serverSeed === "string" &&
        state.serverSeed.length > 0 &&
        typeof state.serverSeedHash === "string" &&
        state.serverSeedHash.length > 0 &&
        Number(state.nonce) > 0;

      if (!hasRecoverableFairState) {
        return;
      }

      this.recoveredWaitingRound = this.normalizeRoundState({
        ...state,
        status: ROUND_STATUS.WAITING,
        startedAt: typeof state.startedAt === "number" ? state.startedAt : Date.now(),
        updatedAt: Date.now(),
      });

      this.emit(CRASH_EVENTS.SEED_HASH, {
        roundId: this.recoveredWaitingRound.roundId,
        nonce: this.recoveredWaitingRound.nonce,
        clientSeed: this.recoveredWaitingRound.clientSeed,
        serverSeedHash: this.recoveredWaitingRound.serverSeedHash,
        status: ROUND_STATUS.WAITING,
        recovered: true,
      });
    }
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
