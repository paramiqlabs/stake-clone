const DATABASE_UNAVAILABLE_MESSAGE = "Database unavailable";

const isDatabaseUnavailableError = (error) => {
  if (!error) {
    return false;
  }

  const code = String(error.code || "");
  const name = String(error.name || "");
  const message = String(error.message || "");

  return (
    code === "P1001" ||
    code === "P1002" ||
    code === "P1003" ||
    name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("Can't connect to database server") ||
    message.includes("ECONNREFUSED")
  );
};

module.exports = {
  DATABASE_UNAVAILABLE_MESSAGE,
  isDatabaseUnavailableError,
};
