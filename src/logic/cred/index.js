export * from "./issue.js";

export const get = async (ctx, id) => {
  const { rdb } = ctx;
  const meta = await rdb.credGetMeta(id);

  return removePrivate(meta);
};

// filter by type only for now
export const filter = async (ctx, did, filter = {}) => {
  const { rdb } = ctx;
  const { type } = filter;

  if (!type) return [];

  const meta = await rdb.credGetMetaForDid(did, type);
  if (!meta) return [];

  let metas = [meta];
  metas = metas.map(removePrivate);

  return metas;
};

export const issued = async (ctx, did, type) => {
  const metas = await filter(ctx, did, { type });
  return !!metas.length;
};

const removePrivate = (meta) => {
  meta = { ...meta };
  delete meta.personIdHash;
  return meta;
};
