const diceService = require("./dice.service");

const playDice = async (req, res) => {
  try {
    const data = await diceService.playDice({
      userId: req.user?.id,
      amount: req.body?.amount,
      target: req.body?.target,
      clientSeed: req.body?.clientSeed,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (
      message.includes("Invalid target") ||
      message.includes("amount") ||
      message.includes("Invalid user id") ||
      message.includes("Insufficient balance")
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

module.exports = {
  playDice,
};
