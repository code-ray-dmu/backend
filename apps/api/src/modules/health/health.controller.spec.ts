import { createApiSuccessBody } from '../../common/dto';
import { HealthController } from './health.controller';
import { HealthFacade } from './health.facade';

describe('HealthController', () => {
  let controller: HealthController;
  let facade: jest.Mocked<HealthFacade>;

  beforeEach((): void => {
    facade = {
      getHealthStatus: jest.fn(),
    } as unknown as jest.Mocked<HealthFacade>;

    controller = new HealthController(facade);
  });

  it('returns the health payload in the API envelope body', async (): Promise<void> => {
    const response = {
      status: jest.fn(),
    } as unknown as { status: jest.Mock };

    response.status.mockReturnValue(response);

    facade.getHealthStatus.mockResolvedValue({
      status: 'ok',
      timestamp: '2026-04-15T00:00:00.000Z',
      services: {
        database: { status: 'up' },
        redis: { status: 'up' },
        rabbitmq: { status: 'up' },
      },
    });

    await expect(controller.getHealthStatus(response as never)).resolves.toEqual(
      createApiSuccessBody({
        status: 'ok',
        timestamp: '2026-04-15T00:00:00.000Z',
        services: {
          database: { status: 'up' },
          redis: { status: 'up' },
          rabbitmq: { status: 'up' },
        },
      }),
    );

    expect(response.status).toHaveBeenCalledWith(200);
  });
});
