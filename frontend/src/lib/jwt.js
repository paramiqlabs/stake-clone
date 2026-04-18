export const parseJwtPayload = (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const [, payloadPart] = token.split(".");
    if (!payloadPart) {
      return null;
    }

    const decoded = JSON.parse(atob(payloadPart));
    return decoded;
  } catch {
    return null;
  }
};
