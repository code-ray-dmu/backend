import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { JwtRefreshGuard } from './jwt-refresh.guard';

describe('JwtRefreshGuard', () => {
  it('rejects missing refresh token bodies as validation errors', async () => {
    const guard = new JwtRefreshGuard();

    expect(() => guard.canActivate(createExecutionContext({}))).toThrow(
      BadRequestException,
    );
  });
});

function createExecutionContext(body: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        body,
      }),
    }),
  } as ExecutionContext;
}
