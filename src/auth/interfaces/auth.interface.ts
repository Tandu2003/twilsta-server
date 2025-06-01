export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
}

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginDto {
  emailOrUsername: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  fullName?: string;
  avatar?: string;
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: Date;
}

export interface TokenResponse {
  accessToken: string;
}

export interface SendVerificationEmailDto {
  email: string;
}

export interface VerifyEmailDto {
  token: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface UpdatePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface CheckUsernameQuery {
  username: string;
}
