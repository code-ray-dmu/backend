import { validate } from 'class-validator';
import { RefreshTokenDto, SignInDto, SignUpDto } from './index';

describe('Auth DTO validation', () => {
  it('accepts a valid sign-up body', async () => {
    const dto = Object.assign(new SignUpDto(), {
      email: 'john@example.com',
      password: '1234',
      name: 'john',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid sign-in email and short passwords', async () => {
    const dto = Object.assign(new SignInDto(), {
      email: 'not-an-email',
      password: '123',
    });

    await expect(validate(dto)).resolves.toHaveLength(2);
  });

  it('requires refreshToken in the refresh-token body', async () => {
    const dto = new RefreshTokenDto();

    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
