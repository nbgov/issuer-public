import * as events from "~/api/events/index.js";
import { hasSomeClient, getClientIds } from "~/logic/client.js";
import { CredType, KycStatus, IssueResult } from "~/const.js";

// we issuing cred only if we can emit it to the client(s) at the moment
export const tryToIssue = async (ctx, kycResult) => {
  const { issuer, rdb, hasher, kyc } = ctx;
  let { did, sessionId, state, data } = kycResult;
  const { status } = state;
  const type = CredType.passport;

  const noClients = () => !hasSomeClient(ctx, did);

  if (noClients()) {
    return IssueResult.noClients;
  }

  if (status !== KycStatus.approved) {
    await emitKycState(ctx, did, state);
    return IssueResult.noKyc;
  }

  let issued = await rdb.credIssuedForDid(did, type);
  if (issued) {
    await kyc.removeSession(did, sessionId);

    const state = { status: KycStatus.notExist };
    await emitKycState(ctx, did, state);

    return IssueResult.alreadyIssuedForDid;
  }

  const { personId } = data;
  const personIdHash = await hasher.hash(personId);

  issued = await rdb.credIssuedForPersonId(personIdHash, type);
  if (issued) {
    await kyc.removeSession(did, sessionId);

    const state = { status: KycStatus.notExist };
    await emitKycState(ctx, did, state);

    return IssueResult.alreadyIssuedForPersonId;
  }

  if (noClients()) {
    return IssueResult.noClients;
  }

  const issuerDid = issuer.did;
  const issuedAt = Date.now();
  const meta = { type, issuerDid, did, personIdHash, issuedAt };

  const cred = await issuer.create(type, did, data);

  if (noClients()) {
    return IssueResult.noClients;
  }

  const id = cred.topLevelFields.get("id");
  await rdb.credSaveMeta(id, meta);

  const emitted = await emitCred(ctx, did, cred);

  if (!emitted) {
    try {
      await rdb.credRemoveMeta(id, meta);
      return IssueResult.noClients;
    } catch (e) {
      // TODO: what should we do?
      // we didn't send cred to client
      // but failed to remove it's meta from rdb
      // so client can't issue the new one
      console.error(`error removing cred id=${id}`, e);
      throw e;
    }
  }

  try {
    await kyc.removeSession(did, sessionId);
    state = { status: KycStatus.notExist };
  } catch (e) {
    // session cleaner will try to remove it later
    console.error(`error removing kyc session ${sessionId}: ${e.message}`);
  }

  await emitKycState(ctx, did, state);

  return IssueResult.issued;
};

const emitCred = async (ctx, did, cred) => {
  const clientIds = getClientIds(ctx, did);
  if (!clientIds.length) return false;

  const emitResults = await events.issuer.issued(ctx, clientIds, cred);
  const emittedToSomeone = emitResults.includes(true);

  return emittedToSomeone;
};

const emitKycState = async (ctx, did, state) => {
  const clientIds = getClientIds(ctx, did);
  if (!clientIds.length) return;

  return events.kyc.stateUpdated(ctx, clientIds, state);
};
