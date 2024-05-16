import * as t from "banditypes";
import { isAddress } from "@polkadot/util-crypto";
import { CredType as CredTypes, ProofType as ProofTypes } from "~/const.js";

const SigWithTypeSize = 65;

export const SigWithType = t
  .instance(Buffer)
  .map((sig) => (sig.length === SigWithTypeSize ? sig : t.fail()));

export const Did = t.string().map((did) => (isAddress(did) ? did : t.fail()));

export const NonEmptyStr = t
  .string()
  .map((type) => (type.length ? type : t.fail()));

export const CredId = NonEmptyStr;
export const CredType = t.enums(Object.values(CredTypes));

export const ProofType = t.enums(Object.values(ProofTypes));
