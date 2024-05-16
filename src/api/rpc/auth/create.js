import * as t from "banditypes";
import { signatureVerify } from "@polkadot/util-crypto";
import { hook } from "~/lib/hook.js";
import { args } from "~/api/hooks/args.js";
import { Did, SigWithType } from "~/api/types.js";
import { throwInvalidSig } from "~/api/errors.js";
import { setClientDid } from "~/logic/client.js";

export const create = hook(
  args(
    t.object({
      did: Did,
      sig: SigWithType,
    }),
  ),
)(async (ctx, req) => {
  const clientId = ctx.client.id;
  const { did, sig } = req;

  const { isValid } = signatureVerify(clientId, sig, did);
  if (!isValid) {
    throwInvalidSig();
  }

  setClientDid(ctx, did);
});
