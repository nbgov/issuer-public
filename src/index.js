import { Worker } from "node:worker_threads";
import { createServer } from "node:http";
import { env, secret } from "~/lib/env.js";
import * as rpcTree from "~/api/rpc/index.js";
import { createWsApi } from "~/lib/ws-api.js";
import { Issuer } from "~/lib/issuer/index.js";
import { Hasher } from "~/lib/hasher.js";
import { Rdb } from "~/logic/rdb.js";
import { createKycWebhook } from "~/logic/kyc/index.js";
import { VeriffKyc } from "~/logic/kyc/providers/veriff.js";
import { CredCfgs, HasherCfg } from "~/const.js";

const port = env("PORT", "8080");
const rdbUrl = env("RDB_URL", "redis://rdb");
const issuerDid = env("ISSUER_DID");
const hashSalt = await secret("hash_salt", { type: "base64" });
const issueKeys = await secret("issue_keys", { type: "json" });

const veriffKey = await secret("veriff_key");
const veriffSecret = await secret("veriff_secret");
const veriffWebhookPath = await secret("veriff_webhook_path");

const appConfig = env("APP_CONFIG", { type: "json" });

const rdb = await new Rdb().init(rdbUrl);
const hasher = new Hasher(hashSalt, HasherCfg);
const kyc = new VeriffKyc({
  key: veriffKey,
  secret: veriffSecret,
  webhookPath: veriffWebhookPath,
  rdb,
});

const credCfgs = CredCfgs.map((cfg) => ({
  ...cfg,
  secretKey: issueKeys[cfg.type],
}));
const issuer = await new Issuer().init(issuerDid, credCfgs);

const ctx = { kyc, issuer, rdb, hasher, appConfig };

const kycWebhook = createKycWebhook(ctx);
const server = createServer(kycWebhook);
ctx.wss = createWsApi(rpcTree, { server, ctx });

server.listen(port);

const workerData = { rdbUrl, veriffKey, veriffSecret };
new Worker("./src/cleaner.js", { workerData });
