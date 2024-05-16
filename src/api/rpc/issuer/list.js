import * as t from "banditypes";
import { hook } from "~/lib/hook.js";
import { auth } from "~/api/hooks/auth.js";
import { args } from "~/api/hooks/args.js";
import { NonEmptyStr } from "~/api/types.js";
import * as cred from "~/logic/cred/index.js";

const Filter = t
  .object({
    type: NonEmptyStr.or(t.optional()),
  })
  .or(t.optional());

export const list = hook(
  auth(),
  args(Filter),
)(async (ctx, filter) => {
  const { did } = ctx.client;

  return cred.filter(ctx, did, filter);
});
