import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    const client = this.getClient();

    if (ttlSeconds) {
      return client.set(key, value, 'EX', ttlSeconds);
    }

    return client.set(key, value);
  }

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.getClient();
    const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');

    return result === 'OK';
  }

  async delete(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  private getClient(): Redis {
    if (this.client) {
      return this.client;
    }

    this.client = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    return this.client;
  }
}
