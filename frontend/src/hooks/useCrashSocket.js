"use client";

import { useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export const useCrashSocket = (token, handlers = {}) => {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onCrashStart = (payload) => handlersRef.current?.onCrashStart?.(payload);
    const onCrashTick = (payload) => handlersRef.current?.onCrashTick?.(payload);
    const onCrashEnd = (payload) => handlersRef.current?.onCrashEnd?.(payload);
    const onSocketError = (payload) => handlersRef.current?.onSocketError?.(payload);
    const onBetPlaced = (payload) => handlersRef.current?.onBetPlaced?.(payload);
    const onCashoutSuccess = (payload) => handlersRef.current?.onCashoutSuccess?.(payload);
    const onCrashResult = (payload) => handlersRef.current?.onCrashResult?.(payload);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("crash_start", onCrashStart);
    socket.on("crash_tick", onCrashTick);
    socket.on("crash_end", onCrashEnd);
    socket.on("socket_error", onSocketError);
    socket.on("bet_placed", onBetPlaced);
    socket.on("cashout_success", onCashoutSuccess);
    socket.on("crash_result", onCrashResult);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("crash_start", onCrashStart);
      socket.off("crash_tick", onCrashTick);
      socket.off("crash_end", onCrashEnd);
      socket.off("socket_error", onSocketError);
      socket.off("bet_placed", onBetPlaced);
      socket.off("cashout_success", onCashoutSuccess);
      socket.off("crash_result", onCrashResult);
      disconnectSocket();
    };
  }, [token]);

  return { connected };
};
