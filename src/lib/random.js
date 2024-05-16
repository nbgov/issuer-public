import { randomBytes } from "node:crypto";

export const randomId = () => randomBytes(16).toString("base64url");
