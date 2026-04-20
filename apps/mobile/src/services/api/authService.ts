import { apiClient, TokenKeys } from './apiClient';
import * as SecureStore from 'expo-secure-store';

export interface SendOtpParams  { phone: string; purpose?: string }
export interface VerifyOtpParams {
  phone: string; otp: string; purpose?: string;
  deviceId?: string; deviceName?: string; platform?: string;
}
export interface AuthTokenResponse {
  accessToken: string; refreshToken: string; expiresIn: number;
  isNewUser: boolean;
  profile: { userId: string; name: string; phone: string; memberships: MembershipInfo[] };
}
export interface MembershipInfo {
  societyId: string; societyName: string; role: string;
  flatId?: string; flatDisplay?: string;
}

export const authService = {
  sendOtp: (params: SendOtpParams) =>
    apiClient.post<{ maskedPhone: string; expiresInSeconds: number }>(
      '/auth/otp/send', { ...params, purpose: params.purpose ?? 'login' }),

  verifyOtp: (params: VerifyOtpParams) =>
    apiClient.post<AuthTokenResponse>(
      '/auth/otp/verify', { ...params, purpose: params.purpose ?? 'login' }),

  saveTokens: async (tokens: Pick<AuthTokenResponse, 'accessToken' | 'refreshToken'>) => {
    await Promise.all([
      SecureStore.setItemAsync(TokenKeys.ACCESS_TOKEN,  tokens.accessToken),
      SecureStore.setItemAsync(TokenKeys.REFRESH_TOKEN, tokens.refreshToken),
    ]);
  },

  clearTokens: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TokenKeys.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(TokenKeys.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(TokenKeys.SOCIETY_ID),
    ]);
  },

  setActiveSociety: (societyId: string) =>
    SecureStore.setItemAsync(TokenKeys.SOCIETY_ID, societyId),

  logout: async (refreshToken: string) => {
    await apiClient.post('/auth/logout', { refreshToken });
    await authService.clearTokens();
  },
};
