import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GitHubService } from '@app/integrations';
import { ApplicantRepositoriesEntity, ApplicantsEntity } from '@app/database';
import { Repository } from 'typeorm';
import { createApiSuccessBody } from '../../common/dto';
import {
  CreateAnalysisRunsResponseDto,
  GetAnalysisRunResponseDto,
  GetAnalysisRunsQueryDto,
  GetAnalysisRunsResponseDto,
} from './dto';
import { AnalysisRunPublisher } from './publishers/analysis-run.publisher';
import { AnalysisRunsRepository } from './repositories/analysis-runs.repository';

@Injectable()
export class AnalysisRunsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly gitHubService: GitHubService,
    @InjectRepository(ApplicantsEntity)
    private readonly applicantsRepository: Repository<ApplicantsEntity>,
    @InjectRepository(ApplicantRepositoriesEntity)
    private readonly applicantRepositoriesRepository: Repository<ApplicantRepositoriesEntity>,
    private readonly analysisRunsRepository: AnalysisRunsRepository,
    private readonly analysisRunPublisher: AnalysisRunPublisher,
  ) {}

  async requestAnalysisRuns(
    applicantId: string,
    currentUserId: string,
  ): Promise<CreateAnalysisRunsResponseDto> {
    const applicant = await this.applicantsRepository.findOne({
      where: { id: applicantId },
      relations: {
        group: true,
      },
    });

    if (!applicant) {
      throw new NotFoundException({
        code: 'APPLICANT_NOT_FOUND',
        message: 'Applicant not found',
      });
    }

    if (applicant.group.userId !== currentUserId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_RESOURCE_ACCESS',
        message: 'You do not have access to this applicant',
      });
    }

    const repositories = await this.syncApplicantRepositories(applicant.id, applicant.githubUrl);

    if (repositories.length === 0) {
      throw new NotFoundException({
        code: 'REPOSITORY_NOT_FOUND',
        message: 'No public repositories found for applicant',
      });
    }

    const completedRepositoryIds = await this.analysisRunsRepository.findCompletedRepositoryIds(
      applicant.id,
      repositories.map((repository) => repository.id),
    );
    const pendingRepositories = repositories.filter(
      (repository) => !completedRepositoryIds.has(repository.id),
    );

    if (pendingRepositories.length === 0) {
      throw new ConflictException({
        code: 'ANALYSIS_RUN_ALREADY_COMPLETED',
        message: 'All selected repositories already have completed analysis runs',
      });
    }

    const publishedAnalysisRunIds: string[] = [];

    for (const repository of pendingRepositories) {
      const analysisRun = await this.analysisRunsRepository.createQueuedRun(
        applicant.id,
        repository.id,
        currentUserId,
      );

      try {
        await this.analysisRunPublisher.publishRequested(analysisRun);
        publishedAnalysisRunIds.push(analysisRun.id);
      } catch (error) {
        const failureReason =
          error instanceof Error ? error.message : 'Failed to publish analysis run request';

        await this.analysisRunsRepository.markFailedByIds([analysisRun.id], failureReason);

        if (publishedAnalysisRunIds.length === 0) {
          throw new InternalServerErrorException({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to enqueue analysis run',
          });
        }

        break;
      }
    }

    return {
      success: true,
      analysis_run_ids: publishedAnalysisRunIds,
    };
  }

  private async syncApplicantRepositories(
    applicantId: string,
    githubUrl: string,
  ): Promise<ApplicantRepositoriesEntity[]> {
    const owner = this.parseOwnerFromGithubUrl(githubUrl);
    const maxSelectionCount = this.configService.get<number>('MAX_REPO_SELECTION_COUNT', 3);
    const repositories = await this.gitHubService.listPublicRepositoriesByOwner(
      owner,
      maxSelectionCount,
    );
    const selectedRepositories = repositories
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, maxSelectionCount);
    const repoFullNames = selectedRepositories.map((repository) => repository.repoFullName);
    const existingRepositories = await this.applicantRepositoriesRepository.find({
      where: {
        applicantId,
      },
    });
    const existingRepositoryMap = new Map<string, ApplicantRepositoriesEntity>(
      existingRepositories.map((repository) => [repository.repoFullName, repository]),
    );
    const entities = selectedRepositories.map((repository) =>
      this.applicantRepositoriesRepository.create({
        id: existingRepositoryMap.get(repository.repoFullName)?.id,
        applicantId,
        repoName: repository.repoName,
        repoFullName: repository.repoFullName,
        repoUrl: repository.repoUrl,
        defaultBranch: repository.defaultBranch,
      }),
    );
    const savedRepositories = await this.applicantRepositoriesRepository.save(entities);
    const savedRepositoryMap = new Map<string, ApplicantRepositoriesEntity>(
      savedRepositories.map((repository) => [repository.repoFullName, repository]),
    );

    return repoFullNames
      .map((repoFullName) => savedRepositoryMap.get(repoFullName))
      .filter((repository): repository is ApplicantRepositoriesEntity => Boolean(repository));
  }

  private parseOwnerFromGithubUrl(githubUrl: string): string {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(githubUrl);
    } catch {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'GitHub URL must be a valid URL',
      });
    }

    if (parsedUrl.hostname !== 'github.com') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'GitHub URL must use github.com',
      });
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    if (pathSegments.length !== 1) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'GitHub URL must match https://github.com/{owner}',
      });
    }

    return pathSegments[0];
  }

  async getAnalysisRunStatus(
    analysisRunId: string,
    currentUserId: string,
  ): Promise<GetAnalysisRunResponseDto> {
    const analysisRun = await this.analysisRunsRepository.findByIdAndRequestedByUserId(
      analysisRunId,
      currentUserId,
    );

    if (!analysisRun) {
      throw new NotFoundException({
        code: 'ANALYSIS_RUN_NOT_FOUND',
        message: 'Analysis run not found',
      });
    }

    return {
      analysis_run_id: analysisRun.id,
      status: analysisRun.status,
      current_stage: analysisRun.currentStage,
      started_at: analysisRun.startedAt,
      completed_at: analysisRun.completedAt,
      failure_reason: analysisRun.failureReason,
    };
  }

  async getAnalysisRuns(
    query: GetAnalysisRunsQueryDto,
    currentUserId: string,
  ): Promise<GetAnalysisRunsResponseDto> {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    const [analysisRuns, total] = await this.analysisRunsRepository.findManyByRequestedByUserId(
      currentUserId,
      {
        applicantId: query.applicantId,
        page,
        size,
      },
    );

    return createApiSuccessBody(
      analysisRuns.map((analysisRun) => ({
        analysis_run_id: analysisRun.id,
        applicant_id: analysisRun.applicantId,
        repository_id: analysisRun.repositoryId,
        status: analysisRun.status,
        current_stage: analysisRun.currentStage,
        started_at: analysisRun.startedAt,
        completed_at: analysisRun.completedAt,
        failure_reason: analysisRun.failureReason,
      })),
      {
        page,
        size,
        total,
      },
    );
  }
}
