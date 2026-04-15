import {
  HTTP_CODE_METADATA,
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthFacade } from './auth.facade';
import { JwtRefreshGuard } from './guards';

describe('AuthController', () => {
  let controller: AuthController;
  let facade: {
    signUp: jest.Mock<ReturnType<AuthFacade['signUp']>, Parameters<AuthFacade['signUp']>>;
    signIn: jest.Mock<ReturnType<AuthFacade['signIn']>, Parameters<AuthFacade['signIn']>>;
    refreshToken: jest.Mock<
      ReturnType<AuthFacade['refreshToken']>,
      Parameters<AuthFacade['refreshToken']>
    >;
  };

  beforeEach(() => {
    facade = {
      signUp: jest.fn(async (_input) => ({
        user_id: 'user-id',
        email: 'john@example.com',
      })),
      signIn: jest.fn(async (_input) => ({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      })),
      refreshToken: jest.fn(async (_authContext) => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      })),
    };
    controller = new AuthController(facade as unknown as AuthFacade);
  });

  it('uses the users route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('users');
  });

  it('maps auth endpoints to the expected POST routes', () => {
    expect(getRouteMetadata('signUp')).toEqual({
      path: 'sign-up',
      method: RequestMethod.POST,
      httpCode: undefined,
      guards: [],
    });
    expect(getRouteMetadata('signIn')).toEqual({
      path: 'sign-in',
      method: RequestMethod.POST,
      httpCode: 200,
      guards: [],
    });
    expect(getRouteMetadata('refreshToken')).toEqual({
      path: 'refresh-token',
      method: RequestMethod.POST,
      httpCode: 200,
      guards: [JwtRefreshGuard],
    });
  });

  it('returns sign-up data for the global API envelope', async () => {
    await expect(
      controller.signUp({
        email: 'john@example.com',
        password: '1234',
        name: 'john',
      }),
    ).resolves.toEqual({
      user_id: 'user-id',
      email: 'john@example.com',
    });
  });

  it('passes validated refresh auth context to the facade', async () => {
    const request = {
      user: {
        sub: 'user-id',
        email: 'john@example.com',
        refreshToken: 'refresh-token',
        refreshTokenId: 1,
      },
    };

    await controller.refreshToken({ refreshToken: 'refresh-token' }, request);

    expect(facade.refreshToken).toHaveBeenCalledWith(request.user);
  });

  it('returns sign-in data for the global API envelope', async () => {
    await expect(
      controller.signIn({
        email: 'john@example.com',
        password: '1234',
      }),
    ).resolves.toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('returns refresh-token data for the global API envelope', async () => {
    await expect(
      controller.refreshToken({
        refreshToken: 'refresh-token',
      }, {
        user: {
          sub: 'user-id',
          email: 'john@example.com',
          refreshToken: 'refresh-token',
          refreshTokenId: 1,
        },
      }),
    ).resolves.toEqual({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });
  });
});

function getRouteMetadata(methodName: keyof AuthController): {
  path: string;
  method: RequestMethod;
  httpCode: number | undefined;
  guards: Array<new (...args: never[]) => unknown>;
} {
  const handler = AuthController.prototype[methodName];

  return {
    path: Reflect.getMetadata(PATH_METADATA, handler),
    method: Reflect.getMetadata(METHOD_METADATA, handler),
    httpCode: Reflect.getMetadata(HTTP_CODE_METADATA, handler),
    guards: Reflect.getMetadata(GUARDS_METADATA, handler) ?? [],
  };
}
