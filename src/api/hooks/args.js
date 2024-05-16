import { tuple } from "banditypes";
import { throwInvalidArgs } from "~/api/errors.js";

export const args = (...types) => {
  const schema = tuple(types);

  return (ctx, ...args) => {
    try {
      return {
        args: schema(args),
      };
    } catch {
      throwInvalidArgs();
    }
  };
};
