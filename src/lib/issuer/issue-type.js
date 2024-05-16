import * as e from "./errors.js";
import {
  BBSPlusSecretKey,
  BBSPlusSignatureParamsG1,
  CredentialSchema,
  SUBJECT_STR,
  SCHEMA_PROPS_STR,
  SignatureType,
} from "@docknetwork/crypto-wasm-ts";

const KeyType = "Bls12381";
const CredSchemaCfg = {
  extraDefinitions: {
    did: { type: "string", format: "uri" },
  },
  topLevelFields: {
    id: { type: "string" },
    type: { type: "string" },
    issuer: { $ref: "#/definitions/did" },
    holder: { $ref: "#/definitions/did" },
  },
};

export const issueTypeNew = (cfg) => {
  const type = cfg.type || e.throwNoType();
  const keyLabel = cfg.keyLabel || e.throwNoKeyLabel(type);
  const subject = cfg.subject || e.throwNoSubject(type);
  let secretKey = cfg.secretKey || e.throwNoKey(type);
  const keyType = KeyType;
  const sigType = SignatureType.BbsPlus;

  const schema = createSchema(subject);
  const sigParams = generateSigParams(schema, keyLabel);

  secretKey = new BBSPlusSecretKey(secretKey);
  const publicKey = secretKey.generatePublicKeyG2(sigParams);

  return { type, schema, keyType, secretKey, publicKey, sigType, sigParams };
};

const createSchema = (subjectSchema) => {
  const jsonSchema = CredentialSchema.essential();

  jsonSchema.definitions = {
    ...jsonSchema.definitions,
    ...CredSchemaCfg.extraDefinitions,
  };

  jsonSchema[SCHEMA_PROPS_STR] = {
    ...jsonSchema[SCHEMA_PROPS_STR],
    ...CredSchemaCfg.topLevelFields,
    [SUBJECT_STR]: {
      type: "object",
      properties: subjectSchema,
    },
  };

  return new CredentialSchema(jsonSchema);
};

const generateSigParams = (schema, label) => {
  const count = schema.flatten()[0].length;

  return BBSPlusSignatureParamsG1.generate(count, label);
};
