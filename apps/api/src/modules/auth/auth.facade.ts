import { Injectable } from '@nestjs/common';
import { SignInDto, SignUpDto } from './dto';
import { AuthService, AuthTokenPair, SignUpResult } from './auth.service';
import { RefreshTokenAuthContext } from './interfaces';

@Injectable()
export class AuthFacade {
  constructor(private readonly authService: AuthService) {}

  async signUp(input: SignUpDto): Promise<SignUpResult> {
    return this.authService.signUp(input);
  }

  async signIn(input: SignInDto): Promise<AuthTokenPair> {
    return this.authService.signIn(input);
  }

  async refreshToken(authContext: RefreshTokenAuthContext): Promise<AuthTokenPair> {
    return this.authService.refreshToken(authContext);
  }
}
