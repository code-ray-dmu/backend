import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
} from './constants';
import { RabbitMqService } from './rabbitmq.service';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('RabbitMqService', () => {
  const assertExchange = jest.fn();
  const assertQueue = jest.fn();
  const bindQueue = jest.fn();
  const publish = jest.fn();
  const consume = jest.fn();
  const ack = jest.fn();
  const nack = jest.fn();
  const closeChannel = jest.fn();
  const createChannel = jest.fn();
  const closeConnection = jest.fn();

  let service: RabbitMqService;

  beforeEach(() => {
    jest.clearAllMocks();

    createChannel.mockResolvedValue({
      assertExchange,
      assertQueue,
      bindQueue,
      publish,
      consume,
      ack,
      nack,
      close: closeChannel,
    });

    (connect as jest.Mock).mockResolvedValue({
      createChannel,
      close: closeConnection,
    });

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'rabbitmq.url') {
          return 'amqp://guest:guest@localhost:5672';
        }

        if (key === 'RABBITMQ_MAX_RETRY') {
          return 2;
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    service = new RabbitMqService(configService);
  });

  it('declares the topology and publishes a message', async () => {
    publish.mockReturnValue(true);

    await service.publish(
      RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_REQUESTED,
      { analysisRunId: 'run-1' },
    );

    expect(assertExchange).toHaveBeenCalledWith(RABBITMQ_EXCHANGES.ANALYSIS_RUNS, 'topic', {
      durable: true,
    });
    expect(assertQueue).toHaveBeenCalledWith(RABBITMQ_QUEUES.ANALYSIS_REQUESTS, {
      durable: true,
      deadLetterExchange: RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      deadLetterRoutingKey: RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_RETRY,
    });
    expect(assertQueue).toHaveBeenCalledWith(RABBITMQ_QUEUES.ANALYSIS_RETRY, {
      durable: true,
      deadLetterExchange: RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      deadLetterRoutingKey: RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_DEAD_LETTER,
    });
    expect(assertQueue).toHaveBeenCalledWith(RABBITMQ_QUEUES.ANALYSIS_DEAD_LETTER, {
      durable: true,
    });
    expect(bindQueue).toHaveBeenCalledWith(
      RABBITMQ_QUEUES.ANALYSIS_REQUESTS,
      RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_REQUESTED,
    );
    expect(publish).toHaveBeenCalledWith(
      RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_REQUESTED,
      expect.any(Buffer),
      {
        contentType: 'application/json',
        persistent: true,
      },
    );
  });

  it('registers a consumer entrypoint and acknowledges successful messages', async () => {
    let consumeHandler: ((message: { content: Buffer } | null) => Promise<void>) | undefined;

    consume.mockImplementation(
      async (
        _queue: string,
        handler: (message: { content: Buffer } | null) => Promise<void>,
      ) => {
        consumeHandler = handler;
      },
    );

    const handler = jest.fn().mockResolvedValue(undefined);

    await service.consume(
      RABBITMQ_QUEUES.ANALYSIS_REQUESTS,
      RABBITMQ_EXCHANGES.ANALYSIS_RUNS,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_RUN_REQUESTED,
      handler,
    );

    await consumeHandler?.({
      content: Buffer.from(JSON.stringify({ analysisRunId: 'run-1' })),
    });

    expect(handler).toHaveBeenCalledWith({ analysisRunId: 'run-1' });
    expect(ack).toHaveBeenCalled();
    expect(nack).not.toHaveBeenCalled();
  });
});
