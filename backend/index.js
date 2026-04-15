const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./src/modules/auth/auth.routes");
const betRoutes = require("./src/modules/bet/bet.routes");
const gameRoutes = require("./src/modules/game/game.routes");
const walletRoutes = require("./src/modules/wallet/wallet.routes");
const { authenticateSocket } = require("./src/socket/socket.auth");
const { setupGameSocket } = require("./src/socket/game.socket");

const PORT = Number(process.env.PORT) || 5000;

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
  res.send("API Run");
});

setupGameSocket(io);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[server] port ${PORT} is already in use`);
    console.error("[server] stop the existing process or set a different PORT in .env");
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, () => {
  console.log(`Server + Socket running on port ${PORT}`);
});
