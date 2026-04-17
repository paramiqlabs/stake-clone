const { CRASH_EVENTS, ROUND_STATUS, getCrashEngine } = require("../modules/crash/crash.engine");
const {
  placeCrashBet,
  cashoutCrashBet,
  settleCrashRound,
  mapCrashError,
} = require("../modules/crash/crash.service");

const CRASH_PLACE_BET_EVENT = "crash_bet";
const CRASH_CASHOUT_EVENT = "crash_cashout";
const BET_PLACED_EVENT = "bet_placed";
const CASHOUT_SUCCESS_EVENT = "cashout_success";
const CRASH_RESULT_EVENT = "crash_result";
const SOCKET_ERROR_EVENT = "socket_error";

const isSocketAuthenticated = (socket) =>
  Boolean(socket?.user?.id && typeof socket.user.role === "string");

const setupCrashSocket = async (io) => {
  const engine = getCrashEngine(io);
  engine.setHooks({
    onRoundCrash: async (payload) => {
      const summary = await settleCrashRound({
        roundId: payload?.roundId,
        finalMultiplier: payload?.multiplier,
      });

      io.emit(CRASH_RESULT_EVENT, summary);
    },
  });

  io.on("connection", async (socket) => {
    if (!isSocketAuthenticated(socket)) {
      socket.emit(SOCKET_ERROR_EVENT, { message: "Unauthorized" });
      socket.disconnect(true);
      return;
    }

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

    socket.on(CRASH_PLACE_BET_EVENT, async (payload) => {
      try {
        const roundState = await engine.getState();
        const result = await placeCrashBet({
          authUserId: socket.user.id,
          amount: payload?.amount,
          roundState,
        });

        socket.emit(BET_PLACED_EVENT, result);
        io.emit(BET_PLACED_EVENT, {
          roundId: result.roundId,
          userId: result.bet.userId,
          amount: result.bet.amount,
          status: result.bet.status,
        });
      } catch (error) {
        const mapped = mapCrashError(error);
        socket.emit(mapped.event, { status: mapped.status, message: mapped.message });
      }
    });

    socket.on(CRASH_CASHOUT_EVENT, async () => {
      try {
        const roundState = await engine.getState();
        const result = await cashoutCrashBet({
          authUserId: socket.user.id,
          roundState,
        });

        socket.emit(CASHOUT_SUCCESS_EVENT, result);
        io.emit(CASHOUT_SUCCESS_EVENT, {
          roundId: result.roundId,
          userId: result.bet.userId,
          payout: result.payout,
          cashoutMultiplier: result.cashoutMultiplier,
          status: result.bet.status,
        });
      } catch (error) {
        const mapped = mapCrashError(error);
        socket.emit(mapped.event, { status: mapped.status, message: mapped.message });
      }
    });
  });

  await engine.start();
};

module.exports = {
  setupCrashSocket,
};
