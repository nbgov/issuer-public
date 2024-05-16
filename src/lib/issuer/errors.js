export const throwNotInitialized = () => th("issuer: not initialized");

export const throwNoType = () => th("issuer: no type");

export const throwNoKeyLabel = (type) => th(`issuer: no key label for ${type}`);

export const throwNoKey = (type) => th(`issuer: no key for '${type}'`);

export const throwNoSubject = (type) => th(`issuer: no subject for '${type}'`);

export const throwTypeNotFound = (type) =>
  th(`issuer: '${type}' type not found`);

const th = (msg) => {
  throw new Error(msg);
};
