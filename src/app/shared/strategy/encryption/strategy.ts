export interface EncryptionStrategy {
  encrypt(data: unknown): Promise<string>;
  decrypt<T>(payload: string): Promise<T>;
}
