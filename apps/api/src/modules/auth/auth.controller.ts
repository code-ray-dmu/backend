import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthFacade } from './auth.facade';
import {
  RefreshTokenDto,
  SignInDto,
  SignUpDto,
} from './dto';
import { AuthTokenPair, SignUpResult } from './auth.service';
import { JwtRefreshGuard } from './guards';
import { RefreshTokenAuthContext } from './interfaces';

@Controller('users')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) {}

  @Post('sign-up')
  async signUp(@Body() body: SignUpDto): Promise<SignUpResult> {
    return this.authFacade.signUp(body);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: SignInDto): Promise<AuthTokenPair> {
    return this.authFacade.signIn(body);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() request: { user: RefreshTokenAuthContext },
  ): Promise<AuthTokenPair> {
    void body;
    return this.authFacade.refreshToken(request.user);
  }
}
