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
  isCurrent?: boolean;
}

export interface RoleSelectionResponse {
  requiresRoleSelection: true;
  preAuthToken: string;
  accounts: AccountOption[];
}

/** The 4 roles a Super Admin may temporarily view/act as. Never 'super_admin' itself. */
export type ImpersonatableRole = 'mahall' | 'survey' | 'institute' | 'member';

export interface StartImpersonationPayload {
  targetRole: ImpersonatableRole;
  tenantId: string;
  instituteId?: string;
  memberId?: string;
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

  /** Every active account sharing the current session's own phone number. */
  getAvailableAccounts: async (): Promise<AccountOption[]> => {
    const response = await api.get<{ success: boolean; data: { accounts: AccountOption[] } }>(
      '/auth/available-accounts'
    );
    return response.data.data.accounts;
  },

  /**
   * Switches the current session to another of the signed-in person's own
   * accounts. Not a role picker — `targetUserId` is the only input; the
   * backend alone decides whether it's authorized.
   */
  switchAccount: async (targetUserId: string): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/switch-account', {
      targetUserId,
    });
    return response.data.data;
  },

  /**
   * Super Admin only — temporarily view/act as another role's context.
   * The backend alone validates the tenant/institute/member combination;
   * this never sends anything the backend treats as a permission grant.
   */
  startImpersonation: async (payload: StartImpersonationPayload): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/impersonate', payload);
    return response.data.data;
  },

  /** Restores the real Super Admin session from an active impersonation session. */
  exitImpersonation: async (): Promise<AuthResponse> => {
    const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/exit-impersonation');
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
