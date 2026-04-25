const minesService = require("./mines.service");

const startMines = async (req, res) => {
  try {
    const data = await minesService.startMines({
      userId: req.user?.id,
      amount: req.body?.amount,
      mineCount: req.body?.mineCount,
      clientSeed: req.body?.clientSeed,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (
      message.includes("mineCount") ||
      message.includes("amount") ||
      message.includes("Invalid user id") ||
      message.includes("Insufficient balance")
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

const revealMines = async (req, res) => {
  try {
    const data = await minesService.revealMines({
      userId: req.user?.id,
      betId: req.body?.betId,
      tileIndex: req.body?.tileIndex,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (
      message.includes("Invalid tileIndex") ||
      message.includes("Bet not found") ||
      message.includes("already") ||
      message.includes("mines")
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

module.exports = {
  startMines,
  revealMines,
};
