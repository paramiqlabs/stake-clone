const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./src/modules/auth/auth.routes");
const betRoutes = require("./src/modules/bet/bet.routes");
const gameRoutes = require("./src/modules/game/game.routes");
const walletRoutes = require("./src/modules/wallet/wallet.routes");
const { authenticateSocket } = require("./src/socket/socket.auth");
const { setupGameSocket } = require("./src/socket/game.socket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.use(authenticateSocket);

app.set("etag", false);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authRoutes);
app.use(betRoutes);
app.use(gameRoutes);
app.use(walletRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

setupGameSocket(io);

server.listen(5000, () => {
  console.log("Server + Socket running on port 5000");
});
