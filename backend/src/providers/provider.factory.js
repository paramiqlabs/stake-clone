const mockProvider = require("./mock.provider");

const getProvider = (providerName) => {
  const normalized = String(providerName || "").trim().toLowerCase();

  if (normalized === "mock") {
    return mockProvider;
  }

  throw new Error("Provider is not supported");
};

module.exports = {
  getProvider,
};
