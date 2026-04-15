import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, ChannelModel, ConsumeMessage, connect } from 'amqplib';
import {
  RABBITMQ_EXCHANGES,
  RABBITMQ_QUEUES,
  RABBITMQ_ROUTING_KEYS,
} from './constants';

type MessageHandler<T extends object> = (payload: T) => Promise<void>;

@Injectable()
export class RabbitMqService implements OnModuleDestroy {
  private connection?: ChannelModel;
  private channel?: Channel;

  constructor(private readonly configService: ConfigService) {}

  async publish<T extends object>(
    exchange: string,
    routingKey: string,
    payload: T,
  ): Promise<void> {
    const channel = await this.getChannel();

    await this.ensureAnalysisRunTopology(channel);
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
      contentType: 'application/json',
      persistent: true,
    });
  }

  async consume<T extends object>(
    queue: string,
    exchange: string,
    routingKey: string,
    handler: MessageHandler<T>,
  ): Promise<void> {
    const channel = await this.getChannel();

    await this.ensureAnalysisRunTopology(channel);
    await channel.bindQueue(queue, exchange, routingKey);
    await channel.consume(queue, async (message) => {
      await this.handleMessage(channel, message, handler);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    this.connection = await connect(this.configService.get<string>('rabbitmq.url') ?? '');
    this.channel = await this.connection.createChannel();

    return this.channel;
  }

  private async ensureAnalysisRunTopology(channel: Channel): Promise<void> {
    await channel.assertExchange(RABBITMQ_EXCHANGES.ANALYSIS_REQUEST, 'topic', {
      durable: true,
    });
    await channel.assertQueue(RABBITMQ_QUEUES.ANALYSIS_REQUEST, {
      durable: true,
      deadLetterExchange: RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      deadLetterRoutingKey: RABBITMQ_ROUTING_KEYS.PHASE4_ANALYSIS_RETRY,
    });
    // Phase 3 범위 밖이지만, Phase 4 운영 전환 시 재활용할 토폴로지를 함께 선언한다.
    await channel.assertQueue(RABBITMQ_QUEUES.PHASE4_ANALYSIS_RETRY, {
      durable: true,
      deadLetterExchange: RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      deadLetterRoutingKey: RABBITMQ_ROUTING_KEYS.PHASE4_ANALYSIS_DEAD_LETTER,
    });
    await channel.assertQueue(RABBITMQ_QUEUES.PHASE4_ANALYSIS_DEAD_LETTER, {
      durable: true,
    });
    await channel.bindQueue(
      RABBITMQ_QUEUES.ANALYSIS_REQUEST,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.ANALYSIS_REQUEST,
    );
    await channel.bindQueue(
      RABBITMQ_QUEUES.PHASE4_ANALYSIS_RETRY,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.PHASE4_ANALYSIS_RETRY,
    );
    await channel.bindQueue(
      RABBITMQ_QUEUES.PHASE4_ANALYSIS_DEAD_LETTER,
      RABBITMQ_EXCHANGES.ANALYSIS_REQUEST,
      RABBITMQ_ROUTING_KEYS.PHASE4_ANALYSIS_DEAD_LETTER,
    );
  }

  private async handleMessage<T extends object>(
    channel: Channel,
    message: ConsumeMessage | null,
    handler: MessageHandler<T>,
  ): Promise<void> {
    if (!message) {
      return;
    }

    try {
      const payload = JSON.parse(message.content.toString()) as T;
      await handler(payload);
      channel.ack(message);
    } catch {
      channel.nack(message, false, false);
    }
  }
}
