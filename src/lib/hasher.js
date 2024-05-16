import argon2 from "argon2";

export class Hasher {
  #salt;
  #cfg;

  constructor(salt, cfg) {
    this.#salt = salt;
    this.#cfg = cfg;
  }

  async hash(data) {
    const salt = this.#salt;
    const cfg = this.#cfg;

    const hash = await argon2.hash(data, { salt, ...cfg });

    return hash.split("$").pop();
  }
}
