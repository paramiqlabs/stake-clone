const { CRASH_EVENTS, ROUND_STATUS, getCrashEngine } = require("../modules/crash/crash.engine");

const setupCrashSocket = async (io) => {
  const engine = getCrashEngine(io);

  io.on("connection", async (socket) => {
    const state = await engine.getState();
    if (!state) {
      return;
    }

    if (state.status === ROUND_STATUS.RUNNING) {
      socket.emit(CRASH_EVENTS.START, {
        roundId: state.roundId,
        multiplier: state.multiplier,
        status: state.status,
      });

      socket.emit(CRASH_EVENTS.TICK, {
        roundId: state.roundId,
        multiplier: state.multiplier,
        status: state.status,
      });
      return;
    }

    if (state.status === ROUND_STATUS.CRASHED) {
      socket.emit(CRASH_EVENTS.END, {
        roundId: state.roundId,
        multiplier: state.multiplier,
        status: state.status,
      });
    }
  });

  await engine.start();
};

module.exports = {
  setupCrashSocket,
};
