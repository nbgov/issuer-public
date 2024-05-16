const StateUpdated = "kyc.state.updated";

export const stateUpdated = async (ctx, clientIds, state) =>
  ctx.wss.emit(clientIds, StateUpdated, state);
