export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  user: UserResponse;
}

export interface UserSignup {
  email: string;
  full_name: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UserProfileUpdate {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface SocialLoginRequest {
  provider: 'google';
  id_token: string;
}

export interface MessageResponse {
  message: string;
}
