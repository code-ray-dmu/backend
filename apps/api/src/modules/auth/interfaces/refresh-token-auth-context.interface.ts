import { JwtPayload } from './jwt-payload.interface';

export interface RefreshTokenAuthContext extends JwtPayload {
  refreshToken: string;
  refreshTokenId: number;
}
