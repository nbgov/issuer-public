export const hook =
  (...hooks) =>
  (rpc) =>
  async (ctx, ...args) => {
    for (const fn of hooks) {
      const res = await fn(ctx, ...args);
      args = res?.args ?? args;

      if (res && "result" in res) {
        return res.result;
      }
    }

    return rpc(ctx, ...args);
  };
