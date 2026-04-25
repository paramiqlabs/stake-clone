const plinkoService = require("./plinko.service");

const playPlinko = async (req, res) => {
  try {
    const data = await plinkoService.playPlinko({
      userId: req.user?.id,
      amount: req.body?.amount,
      rows: req.body?.rows,
      clientSeed: req.body?.clientSeed,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (
      message.includes("rows must be") ||
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
  playPlinko,
};
