import { unsetClientDid } from "~/logic/client.js";

export const remove = (ctx) => {
  unsetClientDid(ctx);
};
