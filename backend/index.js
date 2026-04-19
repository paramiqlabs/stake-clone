const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const authRoutes = require("./src/modules/auth/auth.routes");
const betRoutes = require("./src/modules/bet/bet.routes");
const gameRoutes = require("./src/modules/game/game.routes");
const walletRoutes = require("./src/modules/wallet/wallet.routes");
const { authenticateSocket } = require("./src/socket/socket.auth");
const { setupGameSocket } = require("./src/socket/game.socket");
const prisma = require("./src/lib/prisma");
const {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
} = require("./src/lib/database.errors");

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

io.use(authenticateSocket);

app.set("etag", false);
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authRoutes);
app.use(betRoutes);
app.use(gameRoutes);
app.use(walletRoutes);

app.get("/", (req, res) => {
  res.send("API Run");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[server] port ${PORT} is already in use`);
    console.error("[server] stop the existing process or set a different PORT in .env");
    process.exit(1);
  }

  throw error;
});

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log("[server] database connection ready");
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      console.error(`[server] ${DATABASE_UNAVAILABLE_MESSAGE}`);
      console.error("[server] auth routes may return 503 until MySQL is available");
    } else {
      throw error;
    }
  }

  setupGameSocket(io);
  server.listen(PORT, () => {
    console.log(`Server + Socket running on port ${PORT}`);
  });
};

startServer();
