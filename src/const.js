import { BBS_PLUS_SIGNATURE_PARAMS_LABEL_BYTES } from "@docknetwork/crypto-wasm-ts";

export const HasherCfg = {
  timeCost: 10, // TODO: tune
};

export const KycWebhookBodySizeMax = 64 * 1024; // 64kb
export const KycWebhookStatus = {
  ok: "ok",
  notExist: "not_exist",
  authError: "auth_error",
  badRequest: "bad_request",
};
export const KycStatus = {
  notExist: "not_exist",
  created: "created",
  approved: "approved",
  declined: "declined",
  expired: "expired",
  submitted: "submitted",
  resubmit: "resubmit",
};
export const IssueResult = {
  noClients: "no_clients",
  noKyc: "no_kyc",
  alreadyIssuedForDid: "already_issued_for_did",
  alreadyIssuedForPersonId: "already_issued_for_personId",
  invalidPersonData: "invalid_person_data",
  issued: "issued",
};

export const CredType = {
  passport: "NewBelarusPassport",
};

export const ProofType = {
  kyc: "kyc",
};

export const CredCfgs = [
  {
    type: CredType.passport,
    keyLabel: BBS_PLUS_SIGNATURE_PARAMS_LABEL_BYTES,
    subject: {
      docId: { type: "string" },
      validUntil: { type: "string", format: "date" },
      personId: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      dateOfBirth: { type: "string", format: "date" },
      country: { type: "string" },
    },
  },
];
