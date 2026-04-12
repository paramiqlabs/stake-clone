const express = require("express");
const multer = require("multer");
const gameController = require("./game.controller");
const { authenticate, requireAdmin } = require("../../middleware/auth.middleware");

const router = express.Router();
const upload = multer();

router.get("/games", gameController.getActiveGames);
router.post("/admin/games", authenticate, requireAdmin, upload.none(), gameController.createGame);
router.patch("/admin/games/:id/toggle", authenticate, requireAdmin, gameController.toggleGame);

module.exports = router;
