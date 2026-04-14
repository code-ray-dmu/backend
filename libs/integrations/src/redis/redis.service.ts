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
