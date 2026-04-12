const express = require("express");
const walletController = require("./wallet.controller");
const { authenticate } = require("../../middleware/auth.middleware");

const router = express.Router();

router.get("/wallet", authenticate, walletController.getWallet);
router.post("/wallet/deposit", authenticate, walletController.deposit);
router.post("/wallet/withdraw", authenticate, walletController.withdraw);

module.exports = router;
