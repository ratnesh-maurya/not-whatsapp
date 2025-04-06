declare module "jsencrypt" {
  export class JSEncrypt {
    constructor();
    setPublicKey(publicKey: string): void;
    encrypt(message: string): string | false;
  }
}
