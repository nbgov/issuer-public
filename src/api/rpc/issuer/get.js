import { hook } from "~/lib/hook.js";
import { auth } from "~/api/hooks/auth.js";
import { args } from "~/api/hooks/args.js";
import { throwForbidden } from "~/api/errors.js";
import { CredId } from "~/api/types.js";
import * as cred from "~/logic/cred/index.js";

export const get = hook(
  auth(),
  args(CredId),
)(async (ctx, id) => {
  const { did } = ctx.client;

  const meta = await cred.get(ctx, id);

  if (meta.did !== did) {
    throwForbidden();
  }

  return meta;
});
