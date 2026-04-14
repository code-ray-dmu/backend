import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { Repository } from 'typeorm';

@Injectable()
export class AnalysisRunsRepository {
  constructor(
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
  ) {}

  async findById(analysisRunId: string): Promise<AnalysisRunsEntity | null> {
    return this.analysisRunsRepository.findOne({
      where: { id: analysisRunId },
    });
  }

  async markInProgress(analysisRunId: string, currentStage: AnalysisStage): Promise<void> {
    await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage,
        startedAt: new Date(),
        failureReason: null,
      },
    );
  }

  async markFailed(analysisRunId: string, failureReason: string): Promise<void> {
    await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        status: AnalysisRunStatus.FAILED,
        failureReason,
      },
    );
  }
}
