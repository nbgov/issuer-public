import { hook } from "~/lib/hook.js";
import { auth } from "~/api/hooks/auth.js";

export const get = hook(auth())(async (ctx) => {
  const { client, kyc } = ctx;
  const { did } = client;

  return kyc.getState(did);
});
