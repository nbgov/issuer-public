import { KycWebhookStatus, KycStatus } from "~/const.js";
import { Veriff, SessionNotFound } from "~/lib/veriff.js";

const KycType = "veriff";
const WebhookType = {
  State: "state",
  Decision: "decision",
};
const KycStatusMap = {
  created: KycStatus.created,
  started: KycStatus.created,
  approved: KycStatus.approved,
  declined: KycStatus.declined,
  expired: KycStatus.expired,
  abandoned: KycStatus.expired,
  review: KycStatus.submitted,
  submitted: KycStatus.submitted,
  inflow_completed: KycStatus.submitted, // ???
  resubmission_requested: KycStatus.resubmit,
};

export class VeriffKyc {
  #webhookPath;
  #rdb;
  #veriff;

  constructor(cfg) {
    this.#veriff = new Veriff(cfg);
    this.#webhookPath = cfg.webhookPath;
    this.#rdb = cfg.rdb;
  }

  async getState(did) {
    const session = await this.#getSession(did);
    return session?.state ?? { status: KycStatus.notExist };
  }

  async createSession(did) {
    let session = await this.#getSession(did);
    if (session) {
      const { state, sessionId } = session;

      if (isSessionUsable(state)) {
        return createKycSession(session);
      }

      await this.removeSession(did, sessionId);
    }

    session = await this.#createSession(did);
    return createKycSession(session);
  }

  async removeSession(did, sessionId) {
    sessionId ??= await this.#rdb.veriffGetSessionId(did);
    if (!sessionId) return;

    try {
      await this.#veriff.sessionRemove(sessionId);
    } catch (e) {
      if (!(e instanceof SessionNotFound)) {
        throw e;
      }
    }

    try {
      await this.#rdb.veriffRemoveSession(did, sessionId);
    } catch (e) {
      const msg = `veriff: error removing session from rdb did=${did} sessionId=${sessionId}`;
      console.error(msg, e);
    }
  }

  async getResult(did) {
    const session = await this.#getSession(did);

    return createKycResult(did, session);
  }

  async isWebhook(method, url, headers) {
    return (
      method === "POST" &&
      url.pathname === this.#webhookPath &&
      this.#veriff.keyValid(headers) &&
      !!getWebhookType(url)
    );
  }

  async webhook(headers, url, body) {
    const isSigValid = this.#veriff.sigValid(headers, body);
    if (!isSigValid) {
      return [KycWebhookStatus.authError];
    }

    try {
      body = JSON.parse(body);
    } catch {
      return [KycWebhookStatus.badRequest];
    }

    const type = getWebhookType(url);

    switch (type) {
      case WebhookType.State:
        return this.#webhookState(body);

      case WebhookType.Decision:
        return this.#webhookDecision(body);
    }
  }

  async #webhookState(body) {
    const sessionId = body.id;
    const action = body.action;

    const did = await this.#rdb.veriffGetSessionDid(sessionId);
    if (!did) {
      return [KycWebhookStatus.notExist];
    }

    const status = mapKycStatus(action);
    const state = { status };

    return [KycWebhookStatus.ok, did, state];
  }

  async #webhookDecision(body) {
    const { status, verification } = body;

    if (status !== "success") {
      return [KycWebhookStatus.badRequest];
    }

    const sessionId = verification.id;

    const did = await this.#rdb.veriffGetSessionDid(sessionId);
    if (!did) {
      return [KycWebhookStatus.notExist];
    }

    const state = createKycState({ verification });
    return [KycWebhookStatus.ok, did, state];
  }

  async #createSession(did) {
    const { verification } = await this.#veriff.sessionCreate();

    const state = { status: KycStatus.created };
    const sessionId = verification.id;
    const sessionUrl = verification.url;
    const rdbSession = { sessionId, sessionUrl };

    try {
      await this.#rdb.veriffSaveSession(did, rdbSession);
    } catch (e) {
      try {
        await this.#veriff.sessionRemove(sessionId);
      } catch {
        // if we failed to save session we will try to remove it from Veriff
        // but we're not too worried about success
        // because this session will never reach the end user
        // therefore will not contain any private data
      }

      throw e;
    }

    return { sessionId, sessionUrl, state };
  }

  async #getSession(did) {
    const rdbSession = await this.#rdb.veriffGetSession(did);
    if (!rdbSession) return;

    const { sessionId, sessionUrl } = rdbSession;

    try {
      const [{ verification }, { verifications: attempts }] = await Promise.all(
        [this.#veriff.decision(sessionId), this.#veriff.attempts(sessionId)],
      );

      const state = createKycState({ verification, attempts });

      return { sessionId, sessionUrl, state, verification };
    } catch (e) {
      if (e instanceof SessionNotFound) {
        await this.#rdb.removeSession(did, sessionId);
        return;
      }

      throw e;
    }
  }
}

const isSessionUsable = (state) =>
  [
    KycStatus.created,
    KycStatus.approved,
    KycStatus.submitted,
    KycStatus.resubmit,
  ].includes(state.status);

const createKycSession = (session) => {
  const { state, sessionUrl } = session;

  return {
    state,
    type: KycType,
    cfg: { sessionUrl },
  };
};

const createKycResult = async (did, session) => {
  if (!session) {
    const state = { status: KycStatus.notExist };
    return { did, state };
  }

  const { sessionId, state, verification } = session;
  const res = { did, sessionId, state };

  if (state.status === KycStatus.approved) {
    const { person, document } = verification;
    res.data = {
      docId: document.number,
      validUntil: document.validUntil,
      // we use idNumber for deduplication
      // uppercase it just to be sure
      personId: person.idNumber?.toUpperCase(),
      firstName: person.firstName,
      lastName: person.lastName,
      dateOfBirth: person.dateOfBirth,
      country: document.country,
    };
  }

  return res;
};

const createKycState = ({ verification, attempts = [] }) => {
  if (!verification && !attempts.length) {
    throw new Error("veriff: verification or attempts required for kyc state");
  }

  const lastAttempt = attempts
    .map((attempt) => ({
      ...attempt,
      createdTime: new Date(attempt.createdTime),
    }))
    .sort((a1, a2) => a2.createdTime - a1.createdTime)[0];

  const { status } = lastAttempt ?? verification;
  const kycState = {
    status: mapKycStatus(status),
  };

  const reason = verification?.reason;
  if (reason) {
    kycState.reason = reason;
  }

  return kycState;
};

const mapKycStatus = (status) => {
  const kycStatus = KycStatusMap[status];
  if (!kycStatus) {
    throw new Error(`veriff: invalid status '${status}'`);
  }

  return kycStatus;
};

const getWebhookType = (url) => {
  const type = url.searchParams.get("type");

  if (!Object.values(WebhookType).includes(type)) {
    throw new Error(`veriff: invalid webhook type '${type}'`);
  }

  return type;
};
