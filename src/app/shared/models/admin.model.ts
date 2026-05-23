export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  baseCurrency: string;
  role: 'User' | 'Admin';
  isActive: boolean;
  createdAt: string;
}