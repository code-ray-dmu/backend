import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalysisRunStatus } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { In, Repository } from 'typeorm';

@Injectable()
export class AnalysisRunsRepository {
  constructor(
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
  ) {}

  async createQueuedRun(
    applicantId: string,
    repositoryId: string,
    requestedByUserId: string,
  ): Promise<AnalysisRunsEntity> {
    const analysisRun = this.analysisRunsRepository.create({
      applicantId,
      repositoryId,
      requestedByUserId,
      status: AnalysisRunStatus.QUEUED,
    });

    return this.analysisRunsRepository.save(analysisRun);
  }

  async findCompletedRepositoryIds(
    applicantId: string,
    repositoryIds: string[],
  ): Promise<Set<string>> {
    if (repositoryIds.length === 0) {
      return new Set<string>();
    }

    const analysisRuns = await this.analysisRunsRepository.find({
      select: {
        repositoryId: true,
      },
      where: {
        applicantId,
        repositoryId: In(repositoryIds),
        status: AnalysisRunStatus.COMPLETED,
      },
    });

    return new Set<string>(analysisRuns.map((analysisRun) => analysisRun.repositoryId));
  }

  async findByIdAndRequestedByUserId(
    analysisRunId: string,
    requestedByUserId: string,
  ): Promise<AnalysisRunsEntity | null> {
    return this.analysisRunsRepository.findOne({
      where: {
        id: analysisRunId,
        requestedByUserId,
      },
    });
  }

  async findManyByRequestedByUserId(
    requestedByUserId: string,
    options: {
      applicantId?: string;
      page: number;
      size: number;
    },
  ): Promise<[AnalysisRunsEntity[], number]> {
    const { applicantId, page, size } = options;

    return this.analysisRunsRepository.findAndCount({
      where: {
        requestedByUserId,
        ...(applicantId ? { applicantId } : {}),
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * size,
      take: size,
    });
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

  async markFailedByIds(analysisRunIds: string[], failureReason: string): Promise<void> {
    if (analysisRunIds.length === 0) {
      return;
    }

    await this.analysisRunsRepository.update(
      { id: In(analysisRunIds) },
      {
        status: AnalysisRunStatus.FAILED,
        failureReason,
      },
    );
  }
}
