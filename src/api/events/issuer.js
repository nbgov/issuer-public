const Issued = "issuer.issued";

export const issued = async (ctx, clientIds, cred) =>
  ctx.wss.emit(clientIds, Issued, cred);
