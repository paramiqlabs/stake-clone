const { io } = require("socket.io-client");

const socket = io("http://localhost:5000", {
  auth: {
    token: "YOUR_JWT_TOKEN",
  },
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  // join game
  socket.emit("join_game", { gameId: 1 });
});

socket.on("player_count_update", (data) => {
  console.log("Player count:", data);
});

// simulate leave after 5s
setTimeout(() => {
  socket.emit("leave_game", { gameId: 1 });
  socket.disconnect();
}, 5000);