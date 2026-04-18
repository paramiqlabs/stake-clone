"use client";

import { useEffect, useRef, useState } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export const useSocket = ({ token, events = {} }) => {
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = connectSocket(token);
    if (!socket) {
      return undefined;
    }

    const onConnect = () => {
      setConnected(true);
      setReconnecting(false);
      eventsRef.current?.connect?.();
    };

    const onDisconnect = (reason) => {
      setConnected(false);
      eventsRef.current?.disconnect?.(reason);
    };

    const onReconnectAttempt = (attempt) => {
      setReconnecting(true);
      eventsRef.current?.reconnectAttempt?.(attempt);
    };

    const onReconnect = (attempt) => {
      setReconnecting(false);
      eventsRef.current?.reconnect?.(attempt);
    };

    const onConnectError = (error) => {
      eventsRef.current?.connectError?.(error);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.on("connect_error", onConnectError);

    Object.entries(events).forEach(([eventName, handler]) => {
      if (typeof handler !== "function") {
        return;
      }

      if (["connect", "disconnect", "reconnectAttempt", "reconnect", "connectError"].includes(eventName)) {
        return;
      }

      socket.on(eventName, (payload) => eventsRef.current?.[eventName]?.(payload));
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.off("connect_error", onConnectError);

      Object.entries(events).forEach(([eventName, handler]) => {
        if (typeof handler !== "function") {
          return;
        }

        if (["connect", "disconnect", "reconnectAttempt", "reconnect", "connectError"].includes(eventName)) {
          return;
        }

        socket.off(eventName);
      });

      disconnectSocket();
    };
  }, [token, events]);

  return { connected, reconnecting };
};

