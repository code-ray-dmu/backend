import { Module } from '@nestjs/common';
import { RabbitMqModule, RedisModule } from '@app/integrations';
import { HealthController } from './health.controller';
import { HealthFacade } from './health.facade';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

@Module({
  imports: [RedisModule, RabbitMqModule],
  controllers: [HealthController],
  providers: [HealthService, HealthFacade, HealthRepository],
  exports: [HealthService, HealthFacade, HealthRepository],
})
export class HealthModule {}
