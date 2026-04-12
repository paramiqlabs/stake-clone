const REQUIRED_STRING_FIELDS = ["name", "slug", "provider", "thumbnail", "game_url"];

const ensureStringField = (payload, field) => {
  if (typeof payload[field] !== "string" || payload[field].trim() === "") {
    throw new Error(`'${field}' must be a non-empty string`);
  }
};

const parseBooleanField = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  throw new Error(`'${fieldName}' must be a boolean`);
};

const parseConfigField = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      throw new Error("'config' must be a valid JSON object");
    }
  }

  throw new Error("'config' must be a JSON object");
};

const normalizeCreateGamePayload = (payload) => {
  const normalized = {
    ...payload,
    is_active: parseBooleanField(payload.is_active, "is_active"),
    config: parseConfigField(payload.config),
  };

  validateCreateGamePayload(normalized);
  return normalized;
};

const validateCreateGamePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object");
  }

  REQUIRED_STRING_FIELDS.forEach((field) => ensureStringField(payload, field));

  if (
    payload.is_active !== undefined &&
    typeof payload.is_active !== "boolean"
  ) {
    throw new Error("'is_active' must be a boolean");
  }

  if (
    payload.config !== undefined &&
    (typeof payload.config !== "object" || payload.config === null || Array.isArray(payload.config))
  ) {
    throw new Error("'config' must be a JSON object");
  }
};

module.exports = {
  normalizeCreateGamePayload,
  validateCreateGamePayload,
};
