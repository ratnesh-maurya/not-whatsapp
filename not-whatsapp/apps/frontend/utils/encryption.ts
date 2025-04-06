import { JSEncrypt } from "jsencrypt";

export class Encryption {
  private encryptor: JSEncrypt;

  constructor() {
    this.encryptor = new JSEncrypt();
  }

  setPublicKey(publicKey: string) {
    this.encryptor.setPublicKey(publicKey);
  }

  encryptMessage(message: string): string {
    return this.encryptor.encrypt(message) || "";
  }
}

export const encryption = new Encryption();
