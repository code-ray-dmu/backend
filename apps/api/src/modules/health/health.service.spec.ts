import { RabbitMqService, RedisService } from '@app/integrations';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let healthRepository: jest.Mocked<HealthRepository>;
  let redisService: jest.Mocked<RedisService>;
  let rabbitMqService: jest.Mocked<RabbitMqService>;

  beforeEach((): void => {
    healthRepository = {
      pingDatabase: jest.fn(),
    } as unknown as jest.Mocked<HealthRepository>;
    redisService = {
      ping: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    rabbitMqService = {
      ping: jest.fn(),
    } as unknown as jest.Mocked<RabbitMqService>;

    service = new HealthService(healthRepository, redisService, rabbitMqService);
  });

  it('returns ok when every dependency is reachable', async (): Promise<void> => {
    healthRepository.pingDatabase.mockResolvedValue();
    redisService.ping.mockResolvedValue('PONG');
    rabbitMqService.ping.mockResolvedValue();

    await expect(service.getHealthStatus()).resolves.toMatchObject({
      status: 'ok',
      services: {
        database: { status: 'up' },
        redis: { status: 'up' },
        rabbitmq: { status: 'up' },
      },
    });
  });

  it('marks failing dependencies as down without throwing', async (): Promise<void> => {
    healthRepository.pingDatabase.mockRejectedValue(new Error('db down'));
    redisService.ping.mockResolvedValue('PONG');
    rabbitMqService.ping.mockRejectedValue(new Error('rabbit down'));

    await expect(service.getHealthStatus()).resolves.toMatchObject({
      status: 'error',
      services: {
        database: { status: 'down' },
        redis: { status: 'up' },
        rabbitmq: { status: 'down' },
      },
    });
  });
});
