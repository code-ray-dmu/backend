import { randomUUID } from 'node:crypto';

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

interface AuthApiResponse<TData> {
  data: TData;
  meta: {
    request_id: string;
  };
  error: null;
}

@Controller('users')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) {}

  @Post('sign-up')
  async signUp(@Body() body: SignUpDto): Promise<AuthApiResponse<SignUpResult>> {
    const data = await this.authFacade.signUp(body);

    return createAuthApiResponse(data);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: SignInDto): Promise<AuthApiResponse<AuthTokenPair>> {
    const data = await this.authFacade.signIn(body);

    return createAuthApiResponse(data);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() request: { user: RefreshTokenAuthContext },
  ): Promise<AuthApiResponse<AuthTokenPair>> {
    void body;
    const data = await this.authFacade.refreshToken(request.user);

    return createAuthApiResponse(data);
  }
}

function createAuthApiResponse<TData>(data: TData): AuthApiResponse<TData> {
  return {
    data,
    meta: {
      request_id: randomUUID(),
    },
    error: null,
  };
}
