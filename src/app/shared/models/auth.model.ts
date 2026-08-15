export interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: string;
}

export interface LocalAuthSession {
  ownerId: string;
  user: UserInfo;

  resumeToken: string | null;
}

export interface LocalAuthEnrollment extends LocalAuthSession {
  recoveryCode: string;
}

export interface LocalAuthStatus {
  hasProfile: boolean;

  suggestedName: string;
  unlocked: boolean;

  lockedUntil: number;

  orphanOwners: Array<{ ownerId: string; documents: number }>;
}
