import { workerData } from "node:worker_threads";
import { SessionNotFound, Veriff } from "./lib/veriff.js";
import { Rdb } from "./logic/rdb.js";

const CheckIntervalMs = 10 * 60 * 1000; // 10m
const OutdatedMs = 60 * 60 * 1000; // 1h
const OutdatedApprovedMs = 24 * 60 * 60 * 1000; // 24h

const { rdbUrl, veriffKey, veriffSecret } = workerData;

const rdb = await new Rdb().init(rdbUrl);
const veriff = new Veriff({
  key: veriffKey,
  secret: veriffSecret,
});

// we remove outdated (older than 1h) veriff sessions for privacy reasons
// we can keep approved sessions 24h if the user has passed kyc
// but for some reason did not receive the cred
const clean = async () => {
  const ids = await rdb.veriffGetAllSessionIds();

  for (const id of ids) {
    try {
      const { verifications: attempts } = await veriff.attempts(id);
      const lastAttempt = findLastAttempt(attempts);
      if (!lastAttempt) continue;

      const { status, createdTime } = lastAttempt;

      if (status === "submitted") {
        console.error(`cleaner: outdated session in submitted status '${id}'`);
        continue;
      }

      if (status === "approved" && actual(createdTime, OutdatedApprovedMs)) {
        continue;
      }

      if (actual(createdTime, OutdatedMs)) {
        continue;
      }

      await veriff.sessionRemove(id);
    } catch (e) {
      if (!(e instanceof SessionNotFound)) {
        console.error(
          `cleaner: failed to remove session '${id}': ${e.message}`,
        );
        continue;
      }
    }

    try {
      const did = await rdb.veriffGetSessionDid(id);
      if (!did) continue; // if was removed during our cleanup

      await rdb.veriffRemoveSession(did, id);
    } catch (e) {
      console.error(
        `cleaner: failed to remove session from db '${id}': ${e.message}`,
      );
      // safe to continue
      // we can try to remove it from db later
    }
  }
};

const findLastAttempt = (attempts) =>
  attempts
    .map((attempt) => ({
      ...attempt,
      createdTime: new Date(attempt.createdTime),
    }))
    .sort((t1, t2) => t2 - t1)[0];

const actual = (time, delta) => Date.now() - time < delta;

// main
setInterval(clean, CheckIntervalMs);
await clean();
