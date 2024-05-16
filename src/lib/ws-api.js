import { Server } from "@ws-rpc/server";
import { MsgpackEncoder } from "@ws-rpc/encoder-msgpack";

export const createWsApi = (rpcTree, cfg) => {
  const onrpc = caller(rpcTree);
  const encoders = [MsgpackEncoder];

  return new Server({ encoders, onrpc, ...cfg });
};

// TODO: log errors
const caller =
  (tree) =>
  async (ctx, method, ...args) => {
    const rpc = getRpc(tree, method) || ctx.throwMethodNotFound();

    return rpc(ctx, ...args);
  };

const getRpc = (tree, method) => {
  let res = tree;
  const path = method.split(".");

  do {
    const prop = path.shift();
    if (!Object.hasOwn(res, prop)) {
      return;
    }

    res = res[prop];
  } while (res && path.length);

  if (typeof res !== "function") {
    return;
  }

  return res;
};
