import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { createApiSuccessBody, type ApiSuccessBody } from '../../common/dto';
import { HealthStatusDto } from './dto';
import { HealthFacade } from './health.facade';

@Controller('health')
export class HealthController {
  constructor(private readonly healthFacade: HealthFacade) {}

  @Get()
  async getHealthStatus(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiSuccessBody<HealthStatusDto>> {
    const healthStatus = await this.healthFacade.getHealthStatus();

    response.status(healthStatus.status === 'ok' ? 200 : 503);

    return createApiSuccessBody(healthStatus);
  }
}
