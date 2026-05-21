import { EncryptionStrategy } from '../strategy/encryption/strategy';
import { aesGcmStrategy } from '../strategy/encryption/aes-gcm.strategy';

let activeStrategy: EncryptionStrategy = aesGcmStrategy;

export function setEncryptionStrategy(s: EncryptionStrategy): void {
  activeStrategy = s;
}

export function encrypt(data: unknown): Promise<string> {
  return activeStrategy.encrypt(data);
}

export function decrypt<T>(payload: string): Promise<T> {
  return activeStrategy.decrypt<T>(payload);
}
