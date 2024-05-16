import { throwRpcError } from "@ws-rpc/server";

export const throwInvalidArgs = () => th(1, "invalid args");

export const throwInvalidSig = () => th(2, "invalid sig");

export const throwCredForDidIssued = (did) =>
  th(100, `cred for did '${did}' already issued`);

export const throwCredProverNotSupported = (type, credType) =>
  th(101, `prover '${type}' not supported for '${credType}'`);

export const throwAuthRequired = () => th(401, "auth required");

export const throwForbidden = () => th(403, "forbidden");

const th = (code, message, data) => throwRpcError({ code, message, data });
