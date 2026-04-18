import { io } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";

let socketInstance = null;
let socketToken = null;

export const connectSocket = (token) => {
  if (!token) {
    return null;
  }

  if (socketInstance && socketToken === token) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketToken = token;
  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: { token },
  });

  socketInstance.connect();
  return socketInstance;
};

export const getSocket = () => socketInstance;

export const disconnectSocket = () => {
  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
  socketInstance = null;
  socketToken = null;
};
