import { AuthService } from './auth.service';

const authService = new AuthService();

export async function rotateToken(
  refreshToken: string,
  context?: { userAgent?: string; ipAddress?: string },
) {
  return authService.rotateRefreshToken(refreshToken, context);
}
