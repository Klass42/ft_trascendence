import { tokenStorage } from './token-storage';

/**
 * Socket.io handshake identity, aligned with the realtime gateway contract.
 *
 * Production connections carry the same access JWT used by the HTTP client.
 * During local development `DevTokenStorage` deliberately has no JWT, so the
 * existing `auth.userId` valve remains available to the non-production gateway.
 */
export function socketAuth(userId: string): { token: string } | { userId: string } {
  const token = tokenStorage.getAccessToken();
  return token ? { token } : { userId };
}
