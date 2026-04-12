const express = require("express");
const authRoutes = require("./src/modules/auth/auth.routes");
const gameRoutes = require("./src/modules/game/game.routes");
const walletRoutes = require("./src/modules/wallet/wallet.routes");

const app = express();

app.set("etag", false);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authRoutes);
app.use(gameRoutes);
app.use(walletRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
