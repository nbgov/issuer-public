import { createHmac } from "node:crypto";
import { URL } from "node:url";

const BaseUrl = "https://api.veriff.me";

export const SigDataBody = {};
export class SessionNotFound extends Error {}

export class Veriff {
  #key;
  #secret;

  constructor(cfg) {
    this.#key = cfg.key;
    this.#secret = cfg.secret;
  }

  async sessionCreate() {
    return this.#call({
      path: "v1/sessions",
      method: "POST",
    });
  }

  async sessionRemove(sessionId) {
    return this.#call({
      path: `v1/sessions/${sessionId}`,
      method: "DELETE",
      sigData: sessionId,
    });
  }

  async decision(sessionId) {
    return this.#call({
      path: `v1/sessions/${sessionId}/decision`,
      sigData: sessionId,
    });
  }

  async attempts(sessionId) {
    return this.#call({
      path: `v1/sessions/${sessionId}/attempts`,
      sigData: sessionId,
    });
  }

  async mediaList(sessionId) {
    return this.#call({
      path: `v1/sessions/${sessionId}/media`,
      sigData: sessionId,
    });
  }

  async mediaDownload(id) {
    return this.#call({
      path: `v1/media/${id}`,
      sigData: id,
      raw: true,
    });
  }

  keyValid(headers) {
    const key = headers["x-auth-client"];
    if (!key) return false;

    return key === this.#key;
  }

  sigValid(headers, data) {
    const sig = headers["x-hmac-signature"];
    if (!sig) return false;

    const dataSig = sign(this.#secret, data);

    return sig === dataSig;
  }

  async #call(req) {
    let { path, method = "GET", body, query = {}, sigData, raw } = req;
    const url = new URL(path, BaseUrl);

    body = body && JSON.stringify(body);

    query = Object.entries(query);
    for (const [key, value] of query) {
      url.searchParams.append(key, value);
    }

    const headers = {
      "x-auth-client": this.#key,
    };
    if (sigData) {
      const data = sigData === SigDataBody ? body : sigData;
      headers["x-hmac-signature"] = sign(this.#secret, data);
    }

    const cfg = { method, headers, body };
    let res = await fetch(url, cfg);

    if (raw) {
      return res.arrayBuffer();
    }

    res = await res.json();

    return checkStatus(res);
  }
}

const sign = (secret, data) =>
  createHmac("sha256", secret).update(data).digest("hex");

const checkStatus = (res) => {
  const { status, message, code } = res;
  if (status === "success") {
    return res;
  }

  if (message === "Session not found") {
    throw new SessionNotFound(message);
  }

  throw Object.assign(new Error(message), { code });
};
