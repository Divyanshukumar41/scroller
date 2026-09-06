import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://scrollerbackend.vercel.app";

export const socket = io(SOCKET_URL.replace(/\/+$/, ""), {
  autoConnect: false,
  transports: ["websocket", "polling"],
});
