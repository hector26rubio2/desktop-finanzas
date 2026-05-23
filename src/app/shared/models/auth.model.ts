export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; baseCurrency: string; role: string };
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: string;
}