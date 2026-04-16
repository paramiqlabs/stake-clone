const { io } = require("socket.io-client");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const DEFAULT_EMAIL = "admin@test.com";
const DEFAULT_PASSWORD = "123456";

const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--email" && args[index + 1]) {
      options.email = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--password" && args[index + 1]) {
      options.password = args[index + 1];
      index += 1;
    }
  }

  return options;
};

const loginAndGetToken = async ({ email, password }) => {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Login failed with status ${response.status}: invalid JSON response`);
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || "Unknown login error";
    throw new Error(`Login failed (${response.status}): ${message}`);
  }

  const token = payload?.token;
  if (!token) {
    throw new Error("Login succeeded but response did not include token");
  }

  return token;
};

const connectSocket = (token) => {
  const socket = io(BASE_URL, {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("Connected:", socket.id);
    socket.emit("join_game", { gameId: 1 });
  });

  socket.on("player_count_update", (data) => {
    console.log("Player count:", data);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connect error:", error.message);
  });

  setTimeout(() => {
    socket.emit("leave_game", { gameId: 1 });
    socket.disconnect();
  }, 5000);
};

const main = async () => {
  try {
    const credentials = parseCliArgs();
    const token = await loginAndGetToken(credentials);
    console.log("JWT token:", token);
    connectSocket(token);
  } catch (error) {
    console.error("Unable to start socket test client:", error.message);
    process.exitCode = 1;
  }
};

main();
