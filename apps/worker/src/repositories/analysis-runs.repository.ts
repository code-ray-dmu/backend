import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { Repository } from 'typeorm';

export interface StaleAnalysisRun {
  id: string;
  startedAt?: Date;
}

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
    const result = await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        status: AnalysisRunStatus.IN_PROGRESS,
        currentStage,
        startedAt: new Date(),
        failureReason: null,
      },
    );
    this.assertUpdated(analysisRunId, result.affected);
  }

  async markFailed(analysisRunId: string, failureReason: string): Promise<void> {
    const result = await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        status: AnalysisRunStatus.FAILED,
        failureReason,
      },
    );
    this.assertUpdated(analysisRunId, result.affected);
  }

  async updateCurrentStage(
    analysisRunId: string,
    currentStage: AnalysisStage,
  ): Promise<void> {
    const result = await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        currentStage,
      },
    );
    this.assertUpdated(analysisRunId, result.affected);
  }

  async markCompleted(
    analysisRunId: string,
    currentStage: AnalysisStage,
  ): Promise<void> {
    const result = await this.analysisRunsRepository.update(
      { id: analysisRunId },
      {
        status: AnalysisRunStatus.COMPLETED,
        currentStage,
        completedAt: new Date(),
      },
    );
    this.assertUpdated(analysisRunId, result.affected);
  }

  async findStaleInProgressRuns(input: {
    limit: number;
    staleBefore: Date;
  }): Promise<StaleAnalysisRun[]> {
    const staleRuns = await this.analysisRunsRepository
      .createQueryBuilder('analysisRun')
      .select(['analysisRun.id', 'analysisRun.startedAt'])
      .where('analysisRun.status = :status', { status: AnalysisRunStatus.IN_PROGRESS })
      .andWhere(
        '(analysisRun.startedAt < :staleBefore OR (analysisRun.startedAt IS NULL AND analysisRun.createdAt < :staleBefore))',
        { staleBefore: input.staleBefore },
      )
      .orderBy('analysisRun.startedAt', 'ASC')
      .limit(input.limit)
      .getMany();

    return staleRuns.map((analysisRun) => ({
      id: analysisRun.id,
      startedAt: analysisRun.startedAt,
    }));
  }

  async markStaleRunsFailed(input: {
    analysisRunIds: string[];
    failureReason: string;
  }): Promise<number> {
    if (input.analysisRunIds.length === 0) {
      return 0;
    }

    const result = await this.analysisRunsRepository
      .createQueryBuilder()
      .update(AnalysisRunsEntity)
      .set({
        failureReason: input.failureReason,
        status: AnalysisRunStatus.FAILED,
      })
      .whereInIds(input.analysisRunIds)
      .andWhere('status = :status', { status: AnalysisRunStatus.IN_PROGRESS })
      .execute();

    return result.affected ?? 0;
  }

  private assertUpdated(analysisRunId: string, affected?: number | null): void {
    if (!affected) {
      throw new NotFoundException(`Analysis run ${analysisRunId} not found`);
    }
  }
}
