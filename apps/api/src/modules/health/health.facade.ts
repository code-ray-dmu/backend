import { Injectable } from '@nestjs/common';
import { HealthStatusDto } from './dto';
import { HealthService } from './health.service';

@Injectable()
export class HealthFacade {
  constructor(private readonly healthService: HealthService) {}

  async getHealthStatus(): Promise<HealthStatusDto> {
    return this.healthService.getHealthStatus();
  }
}
