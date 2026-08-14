export interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: string;
}

/** Sesión abierta contra el perfil local. No hay servidor ni token de acceso. */
export interface LocalAuthSession {
  ownerId: string;
  user: UserInfo;
  /** Presente solo si el usuario pidió mantener la sesión abierta. */
  resumeToken: string | null;
}

/** Alta y recuperación devuelven además el código, que se muestra una sola vez. */
export interface LocalAuthEnrollment extends LocalAuthSession {
  recoveryCode: string;
}

export interface LocalAuthStatus {
  hasProfile: boolean;
  /** Nombre de la cuenta del sistema, solo como sugerencia editable en el alta. */
  suggestedName: string;
  unlocked: boolean;
  /** Epoch ms hasta el que el ingreso está pausado por intentos fallidos; 0 si no lo está. */
  lockedUntil: number;
  /**
   * Datos que ya viven en SQLite sin perfil que los reclame — típicamente de
   * cuando la identidad la daba el API. El alta adopta el dueño cuando hay uno
   * solo; con varios exige que el usuario elija.
   */
  orphanOwners: Array<{ ownerId: string; documents: number }>;
}
