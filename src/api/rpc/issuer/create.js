import * as t from "banditypes";
import { hook } from "~/lib/hook.js";
import { auth } from "~/api/hooks/auth.js";
import { args } from "~/api/hooks/args.js";
import { throwCredProverNotSupported } from "~/api/errors.js";
import * as at from "~/api/types.js";
import * as cred from "~/logic/cred/index.js";
import { CredType, ProofType } from "~/const.js";

const Proof = t.object({
  type: at.ProofType,
  credentialType: at.CredType,
  data: t.unknown(),
});

export const create = hook(
  auth(),
  args(Proof),
)(async (ctx, proof) => {
  let { type, credentialType, data } = proof;

  const supportedProvers = SupportedProvers[credentialType];
  if (!supportedProvers?.includes(type)) {
    throwCredProverNotSupported(type, credentialType);
  }

  data = await Provers[type](ctx, data);

  return Issuers[credentialType](ctx, data);
});

const kyc = async (ctx) => {
  const { kyc, client } = ctx;
  const { did } = client;

  return kyc.getResult(did);
};

const passport = async (ctx, kycResult) => cred.tryToIssue(ctx, kycResult);

const SupportedProvers = {
  [CredType.passport]: [ProofType.kyc],
};

const Provers = {
  [ProofType.kyc]: kyc,
};

const Issuers = {
  [CredType.passport]: passport,
};
