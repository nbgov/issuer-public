export const get = (ctx) => {
  const { did, issueTypes } = ctx.issuer;
  const time = new Date();

  return { time, did, issueTypes };
};
