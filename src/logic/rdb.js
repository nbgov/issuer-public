import { createClient, WatchError } from "@redis/client";

// did -> {sessionId, sessionUrl}
const VeriffSessionNs = "veriffSession";

// sessionId -> did
const VeriffSessionDidNs = "veriffSessionDid";

// credId -> {type, issuerDid, did, personIdHash, issuedAt}
const CredNs = "cred";

// did, type -> credId
const DidCredNs = "didCred";

// personIdHash, type -> credId
const PersonIdCredNs = "personIdCred";

export class Rdb {
  #client;

  async init(url) {
    this.#client = await createClient({ url }).connect();
    return this;
  }

  async veriffGetAllSessionIds() {
    const allSessionsKey = getKycSessionDidKey("*");
    const keys = await this.#client.keys(allSessionsKey);

    return keys.map((key) => keyParts(key)[1]);
  }

  async veriffSaveSession(did, session) {
    const { sessionId } = session;
    const sessionKey = getVeriffSessionKey(did);
    const sessionDidKey = getKycSessionDidKey(sessionId);

    return this.#client.executeIsolated(async (client) => {
      await client.watch(sessionKey);

      const hasSession = await this.veriffHasSession(did, client);
      if (hasSession) {
        throw new Error(`rdb: session already exists did=${did}`);
      }

      await client
        .multi()
        .hSet(sessionKey, session)
        .set(sessionDidKey, did)
        .exec();
    });
  }

  async veriffRemoveSession(did, sessionId) {
    const sessionKey = getVeriffSessionKey(did);
    const sessionDidKey = getKycSessionDidKey(sessionId);

    try {
      await this.#client.executeIsolated(async (client) => {
        await client.watch(sessionKey);

        const currentSessionId = await this.veriffGetSessionId(did, client);
        if (currentSessionId !== sessionId) {
          // some concurrent request already removed session
          // and possibly the new one was created
          await client.unwatch();
          return;
        }

        await client.multi().del([sessionKey, sessionDidKey]).exec();
      });
    } catch (e) {
      // some concurrent request already removed it
      // and possibly created the new one
      if (e instanceof WatchError) return;

      throw e;
    }
  }

  async veriffHasSession(did, client = this.#client) {
    const sessionKey = getVeriffSessionKey(did);
    const count = await client.exists(sessionKey);
    return !!count;
  }

  async veriffGetSession(did, client = this.#client) {
    const sessionKey = getVeriffSessionKey(did);
    const session = await client.hGetAll(sessionKey);
    return session.sessionId && session;
  }

  async veriffGetSessionId(did, client = this.#client) {
    const sessionKey = getVeriffSessionKey(did);
    return client.hGet(sessionKey, "sessionId");
  }

  async veriffGetSessionDid(sessionId, client = this.#client) {
    const sessionDidKey = getKycSessionDidKey(sessionId);
    return client.get(sessionDidKey);
  }

  // only one cred with the same type per did and per personId allowed
  async credSaveMeta(id, meta) {
    const { type, did, personIdHash } = meta;
    const credKey = getCredKey(id);
    const didCredKey = getDidCredKey(did, type);
    const personIdCredKey = getPersonIdCredKey(personIdHash, type);

    return this.#client.executeIsolated(async (client) => {
      // we save cred meta in watched transaction
      // to prevent issuing another cred with the same type
      // during concurrent requests
      await client.watch([didCredKey, personIdCredKey]);

      let issued = await this.credIssuedForDid(did, type, client);
      if (issued) {
        throw new Error(`rdb: cred already issued for did=${did}`);
      }

      issued = await this.credIssuedForPersonId(personIdHash, type, client);
      if (issued) {
        throw new Error("rdb: cred already issued for personId");
      }

      await client
        .multi()
        .hSet(credKey, meta)
        .set(didCredKey, id)
        .set(personIdCredKey, id)
        .exec();
    });
  }

  async credRemoveMeta(id, meta) {
    const { type, did, personIdHash } = meta;
    const credKey = getCredKey(id);
    const didCredKey = getDidCredKey(did, type);
    const personIdCredKey = getPersonIdCredKey(personIdHash, type);
    const keys = [credKey, didCredKey, personIdCredKey];

    return this.#client.executeIsolated(async (client) => {
      await client.watch(keys);

      const [currentIdForDid, currentIdForPersonId] = await Promise.all([
        this.credGetIdForDid(did, type, client),
        this.credGetIdForPersonId(personIdHash, type, client),
      ]);
      if (currentIdForDid !== id || currentIdForPersonId !== id) {
        // some concurrent request already removed cred
        // and possibly the new one was created
        await client.unwatch();
        return;
      }

      await client.multi().del(keys).exec();
    });
  }

  async credGetMetaForDid(did, type, client = this.#client) {
    const id = await this.credGetIdForDid(did, type, client);
    return this.credGetMeta(id, client);
  }

  async credGetMeta(id, client = this.#client) {
    const key = getCredKey(id);
    const meta = await client.hGetAll(key);
    return meta.did && { id, ...meta };
  }

  async credGetIdForDid(did, type, client = this.#client) {
    const key = getDidCredKey(did, type);
    return client.get(key);
  }

  async credGetIdForPersonId(personIdHash, type, client = this.#client) {
    const key = getPersonIdCredKey(personIdHash, type);
    return client.get(key);
  }

  async credIssuedForDid(did, type, client = this.#client) {
    const key = getDidCredKey(did, type);
    const count = await client.exists(key);
    return !!count;
  }

  async credIssuedForPersonId(personIdHash, type, client = this.#client) {
    const key = getPersonIdCredKey(personIdHash, type);
    const count = await client.exists(key);
    return !!count;
  }
}

const getVeriffSessionKey = (did) => fullKey(VeriffSessionNs, did);

const getKycSessionDidKey = (sessionId) =>
  fullKey(VeriffSessionDidNs, sessionId);

const getCredKey = (id) => fullKey(CredNs, id);

const getDidCredKey = (did, type) => fullKey(DidCredNs, did, type);

const getPersonIdCredKey = (personIdHash, type) =>
  fullKey(PersonIdCredNs, personIdHash, type);

const fullKey = (...parts) => parts.join(":");

const keyParts = (key) => key.split(":");
