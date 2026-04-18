const express = require("express");
const betController = require("./bet.controller");
const { authenticate } = require("../../middleware/auth.middleware");

const router = express.Router();

router.post("/bet", authenticate, betController.placeBet);
router.post("/bet/:id/resolve", authenticate, betController.resolveBet);
router.get("/bets/me", authenticate, betController.getMyBets);

module.exports = router;
