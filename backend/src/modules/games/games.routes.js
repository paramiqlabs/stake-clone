const express = require("express");
const { authenticate } = require("../../middleware/auth.middleware");
const diceController = require("./dice/dice.controller");
const minesController = require("./mines/mines.controller");
const plinkoController = require("./plinko/plinko.controller");

const router = express.Router();

router.post("/games/dice/play", authenticate, diceController.playDice);
router.post("/games/mines/start", authenticate, minesController.startMines);
router.post("/games/mines/reveal", authenticate, minesController.revealMines);
router.post("/games/plinko/play", authenticate, plinkoController.playPlinko);

module.exports = router;
