import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client?: Redis;

  constructor(private readonly configService: ConfigService) {}

  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.getClient();
    const result = await client.set(key, value, 'EX', ttlSeconds, 'NX');

    return result === 'OK';
  }

  async ping(): Promise<string> {
    return this.getClient().ping();
  }

  async delete(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  async expireIfValueMatches(
    key: string,
    expectedValue: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const script = `
      local current = redis.call('GET', KEYS[1])
      if current == ARGV[1] then
        return redis.call('EXPIRE', KEYS[1], ARGV[2])
      end
      return 0
    `;
    const result = await this.getClient().eval(
      script,
      1,
      key,
      expectedValue,
      String(ttlSeconds),
    );

    return result === 1;
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
      host: this.configService.getOrThrow<string>('redis.host'),
      port: this.configService.getOrThrow<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.getClient().get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    const serializedValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      return this.getClient().set(key, serializedValue, 'EX', ttlSeconds);
    }

    return this.getClient().set(key, serializedValue);
  }
}
