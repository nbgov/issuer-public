import fs from "node:fs/promises";

const SecretsDir = "/run/secrets";

export function env(name, def, options) {
  name = name.toUpperCase();

  const hasMoreArgs = arguments.length > 1;
  const value = process.env[name];
  delete process.env[name];

  return parseConfigVariable(name, value, hasMoreArgs, def, options);
}

export async function secret(name, def, options) {
  if (process.env.NODE_ENV === "development") {
    return env(...arguments);
  }

  const hasMoreArgs = arguments.length > 1;
  const path = `${SecretsDir}/${name}`;

  let value;
  try {
    value = await fs.readFile(path, "utf8");
  } catch (e) {}

  return parseConfigVariable(name, value, hasMoreArgs, def, options);
}

function parseConfigVariable(name, value, hasMoreArgs, def, options = {}) {
  let hasDef = hasMoreArgs;
  if (typeof def === "object") {
    options = def;
    def = undefined;
    hasDef = false;
  }

  const { type } = options;

  if (value === undefined) {
    if (!hasDef) throw new Error(`${name} config variable required`);
    value = def;
  }

  value = value.trim();

  switch (type) {
    case "base64":
      return Buffer.from(value, "base64");
    case "hex":
      return Buffer.from(value, "hex");
    case "json":
      return JSON.parse(value);
    default:
      return value;
  }
}
