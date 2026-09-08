import api from './api';
import { User } from '@/types';

export interface LoginCredentials {
  phone: string;
  password: string;
}

export interface OTPCredentials {
  phone: string;
  otp: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AccountOption {
  userId: string;
  role: string;
  name: string;
  tenantId: string | null;
  tenantName: string | null;
  instituteId?: string;
  instituteName?: string | null;
}

export interface RoleSelectionResponse {
  requiresRoleSelection: true;
  preAuthToken: string;
  accounts: AccountOption[];
}

export const authService = {
  login: async (credentials: LoginCredentials) => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login', credentials);
    return response.data.data;
  },

  sendOTP: async (phone: string) => {
    const response = await api.post<{ success: boolean; message: string; otp?: string }>('/auth/send-otp', {
      phone,
    });
    return response.data;
  },

  verifyOTP: async (credentials: OTPCredentials): Promise<AuthResponse | RoleSelectionResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse | RoleSelectionResponse }>(
      '/auth/verify-otp',
      credentials
    );
    return response.data.data;
  },

  selectAccount: async (preAuthToken: string, userId: string): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/select-account', {
      preAuthToken,
      userId,
    });
    return response.data.data;
  },

  getCurrentUser: async () => {
    const response = await api.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /** Task C5 — two-factor login for the signed-in user's own account. */
  setTwoFactor: async (enabled: boolean) => {
    const response = await api.put<{ success: boolean; data: { twoFactorEnabled: boolean } }>(
      '/auth/two-factor',
      { enabled }
    );
    return response.data.data;
  },

  registerDevice: async (oneSignalPlayerId: string) => {
    const response = await api.put<{ success: boolean; message: string }>('/auth/register-device', {
      oneSignalPlayerId,
    });
    return response.data;
  },
};
