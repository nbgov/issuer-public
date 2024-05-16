import {
  initializeWasm,
  BBSPlusCredentialBuilder,
} from "@docknetwork/crypto-wasm-ts";
import { randomId } from "~/lib/random.js";
import * as e from "./errors.js";
import { issueTypeNew } from "./issue-type.js";

export class Issuer {
  #did;
  #initialized = false;
  #issueTypes = new Map();

  get did() {
    return this.#did;
  }

  get issueTypes() {
    return Array.from(this.#issueTypes.values(), (issueType) => ({
      type: issueType.type,
      schema: issueType.schema.toJSON(),
      keyType: issueType.keyType,
      publicKey: issueType.publicKey.value,
      sigType: issueType.sigType,
    }));
  }

  async init(did, cfgs = []) {
    await initializeWasm();

    cfgs.forEach(this.addType);

    this.#did = did;
    this.#initialized = true;

    return this;
  }

  addType = (cfg) => {
    const credType = issueTypeNew(cfg);
    this.#issueTypes.set(credType.type, credType);
  };

  create(type, holderDid, data) {
    this.#initialized || e.throwNotInitialized();

    const { schema, secretKey, sigParams } = this.#getIssueType(type);
    const id = randomId();

    const builder = new BBSPlusCredentialBuilder();
    builder.schema = schema;
    builder.subject = data;
    builder.setTopLevelField("id", id);
    builder.setTopLevelField("type", type);
    builder.setTopLevelField("issuer", this.#did);
    builder.setTopLevelField("holder", holderDid);

    return builder.sign(secretKey, sigParams);
  }

  #getIssueType(type) {
    return this.#issueTypes.get(type) || e.throwTypeNotFound(type);
  }
}
