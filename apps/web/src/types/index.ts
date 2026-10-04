export type Role = 'ADMIN' | 'KITCHEN' | 'DISPATCH' | 'DRIVER';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
}
