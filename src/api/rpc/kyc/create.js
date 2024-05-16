import { hook } from "~/lib/hook.js";
import { auth } from "~/api/hooks/auth.js";
import * as cred from "~/logic/cred/index.js";
import * as kyc from "~/logic/kyc/index.js";
import { throwCredForDidIssued } from "~/api/errors.js";
import { CredType } from "~/const.js";

export const create = hook(auth())(async (ctx) => {
  const { did } = ctx.client;

  const issued = await cred.issued(ctx, did, CredType.passport);
  if (issued) {
    throwCredForDidIssued(did);
  }

  return kyc.createSession(ctx, did);
});
