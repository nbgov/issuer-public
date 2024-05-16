import { throwAuthRequired } from "~/api/errors.js";

export const auth = () => (ctx) => {
  ctx.client.did || throwAuthRequired();
};
