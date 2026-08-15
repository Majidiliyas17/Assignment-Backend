export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
}
