import { EncryptionStrategy } from '../strategy/encryption/strategy';
import { aesGcmStrategy } from '../strategy/encryption/aes-gcm.strategy';
import { ipcCryptoStrategy } from '../strategy/encryption/ipc-crypto.strategy';

function hasElectronCrypto(): boolean {
  const a = (window as unknown as Record<string, unknown>)['electronAPI'] as Record<string, unknown> | undefined;
  return !!a && typeof a['cryptoEncrypt'] === 'function';
}

// En Electron: cifrado en el proceso main (clave fuera del renderer).
// En navegador/dev: cifrado web con worker (clave desde environment).
let activeStrategy: EncryptionStrategy = hasElectronCrypto() ? ipcCryptoStrategy : aesGcmStrategy;

export function setEncryptionStrategy(s: EncryptionStrategy): void {
  activeStrategy = s;
}

export function encrypt(data: unknown): Promise<string> {
  return activeStrategy.encrypt(data);
}

export function decrypt<T>(payload: string): Promise<T> {
  return activeStrategy.decrypt<T>(payload);
}
