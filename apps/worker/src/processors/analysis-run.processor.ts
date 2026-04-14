import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { AnalysisRunsEntity } from '@app/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubRepositoryProcessor } from './github-repository.processor';
import { LlmAnalysisProcessor } from './llm-analysis.processor';

@Injectable()
export class AnalysisRunProcessor {
  constructor(
    private readonly githubRepositoryProcessor: GithubRepositoryProcessor,
    private readonly llmAnalysisProcessor: LlmAnalysisProcessor,
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
  ) {}

  async process(analysisRunId: string): Promise<void> {
    await this.markInProgress(analysisRunId);

    try {
      await this.updateCurrentStage(analysisRunId, AnalysisStage.REPO_LIST);
      const repositoryInfo =
        await this.githubRepositoryProcessor.syncRepositoryInfo(analysisRunId);

      await this.updateCurrentStage(analysisRunId, AnalysisStage.FOLDER_STRUCTURE);
      const filePaths = await this.githubRepositoryProcessor.getRepositoryFilePaths({
        analysisRunId,
        defaultBranch: repositoryInfo.defaultBranch,
      });
      const selectedPaths = await this.llmAnalysisProcessor.selectFiles({
        analysisRunId,
        filePaths,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.FILE_DETAIL);
      const selectedFiles = await this.githubRepositoryProcessor.saveSelectedFiles({
        analysisRunId,
        defaultBranch: repositoryInfo.defaultBranch,
        selectedPaths,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.SUMMARY);
      await this.llmAnalysisProcessor.analyzeCode({
        analysisRunId,
        files: selectedFiles,
      });

      await this.updateCurrentStage(analysisRunId, AnalysisStage.QUESTION_GENERATION);
      await this.llmAnalysisProcessor.generateQuestions({
        analysisRunId,
      });

      await this.analysisRunsRepository.update(analysisRunId, {
        completedAt: new Date(),
        failureReason: null,
        status: AnalysisRunStatus.COMPLETED,
      });
    } catch (error) {
      await this.analysisRunsRepository.update(analysisRunId, {
        completedAt: null,
        failureReason: this.toFailureReason(error),
        status: AnalysisRunStatus.FAILED,
      });

      throw error;
    }
  }

  private async markInProgress(analysisRunId: string): Promise<void> {
    const analysisRun = await this.analysisRunsRepository.findOne({
      where: {
        id: analysisRunId,
      },
    });

    if (!analysisRun) {
      throw new Error(`Analysis run not found: ${analysisRunId}`);
    }

    await this.analysisRunsRepository.update(analysisRunId, {
      completedAt: null,
      failureReason: null,
      startedAt: new Date(),
      status: AnalysisRunStatus.IN_PROGRESS,
    });
  }

  private async updateCurrentStage(
    analysisRunId: string,
    stage: AnalysisStage,
  ): Promise<void> {
    await this.analysisRunsRepository.update(analysisRunId, {
      currentStage: stage,
    });
  }

  private toFailureReason(error: unknown): string {
    if (error instanceof Error && /^[A-Z_]+: /.test(error.message)) {
      return error.message;
    }

    if (error instanceof Error) {
      return `ANALYSIS_PIPELINE_FAILED: ${error.message}`;
    }

    return 'ANALYSIS_PIPELINE_FAILED: Unknown analysis pipeline failure';
  }
}
