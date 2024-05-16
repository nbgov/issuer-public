export const setClientDid = (ctx, did) => (ctx.client.did = did);

export const unsetClientDid = (ctx) => delete ctx.client.did;

export const getClientIds = (ctx, did) => {
  if (!did) return [];

  return Array.from(ctx.wss.clients)
    .filter((client) => client.did === did)
    .map((client) => client.id);
};

export const hasSomeClient = (ctx, did) => !!getClientIds(ctx, did).length;
