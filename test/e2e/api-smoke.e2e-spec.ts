import { Test } from '@nestjs/testing';

describe.skip('API smoke test placeholder', () => {
  it('boots the API application module', async () => {
    const { AppModule } = await import('../../apps/api/src/app.module');
    const testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(testingModule).toBeDefined();
  });
});
