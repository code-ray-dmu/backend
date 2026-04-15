import {
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  RepositoryFilesEntity,
} from '@app/database';
import {
  GitHubService,
  GitHubServiceError,
  type RepositoryMetadataDto,
  type RepositorySourceFileDto,
} from '@app/integrations';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GithubRepositoryProcessor {
  private readonly maxFileSizeBytes = 100 * 1024;

  constructor(
    private readonly gitHubService: GitHubService,
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
    @InjectRepository(ApplicantRepositoriesEntity)
    private readonly applicantRepositoriesRepository: Repository<ApplicantRepositoriesEntity>,
    @InjectRepository(RepositoryFilesEntity)
    private readonly repositoryFilesRepository: Repository<RepositoryFilesEntity>,
  ) {}

  async syncRepositoryInfo(analysisRunId: string): Promise<RepositoryMetadataDto> {
    const analysisRun = await this.getAnalysisRunWithRepository(analysisRunId);
    const repositoryInfo = await this.executeGitHubStep(async () => {
      return this.gitHubService.getRepositoryMetadata({
        repoFullName: analysisRun.repository.repoFullName,
      });
    });

    await this.applicantRepositoriesRepository.update(analysisRun.repositoryId, {
      defaultBranch: repositoryInfo.defaultBranch,
    });

    return repositoryInfo;
  }

  async getRepositoryFilePaths(input: {
    analysisRunId: string;
    defaultBranch: string;
  }): Promise<string[]> {
    const analysisRun = await this.getAnalysisRunWithRepository(input.analysisRunId);
    const repositoryTree = await this.executeGitHubStep(async () => {
      return this.gitHubService.getRepositoryTree({
        repoFullName: analysisRun.repository.repoFullName,
        branch: input.defaultBranch,
      });
    });

    return repositoryTree.items
      .filter((entry) => {
        return entry.type === 'blob' && typeof entry.path === 'string' && entry.path.length > 0;
      })
      .map((entry) => {
        return entry.path;
      });
  }

  async saveSelectedFiles(input: {
    analysisRunId: string;
    defaultBranch: string;
    selectedPaths: string[];
  }): Promise<Array<{ content: string; path: string }>> {
    const analysisRun = await this.getAnalysisRunWithRepository(input.analysisRunId);
    const uniqueSelectedPaths = [...new Set(input.selectedPaths)];
    const files = await this.executeGitHubStep(async () => {
      return Promise.all(
        uniqueSelectedPaths.map(async (path) => {
          const sourceFile = await this.gitHubService.getRepositorySourceFile({
            repoFullName: analysisRun.repository.repoFullName,
            path,
            ref: input.defaultBranch,
          });

          return {
            path,
            sourceFile,
          };
        }),
      );
    });

    const storableFiles = files.filter((file) => {
      return this.isEligibleRepositorySourceFile(file.sourceFile);
    });

    await this.replaceRepositoryFiles({
      files: storableFiles,
      repositoryId: analysisRun.repositoryId,
    });

    return storableFiles.map((file) => {
      return {
        content: file.sourceFile.decodedContent,
        path: file.path,
      };
    });
  }

  private async getAnalysisRunWithRepository(
    analysisRunId: string,
  ): Promise<AnalysisRunsEntity & { repository: ApplicantRepositoriesEntity }> {
    const analysisRun = await this.analysisRunsRepository.findOne({
      relations: {
        repository: true,
      },
      where: {
        id: analysisRunId,
      },
    });

    if (!analysisRun?.repository) {
      throw new Error(`Analysis run repository context not found: ${analysisRunId}`);
    }

    return analysisRun as AnalysisRunsEntity & { repository: ApplicantRepositoriesEntity };
  }
  private async replaceRepositoryFiles(input: {
    files: Array<{ path: string; sourceFile: RepositorySourceFileDto }>;
    repositoryId: string;
  }): Promise<void> {
    await this.repositoryFilesRepository.manager.transaction(async (entityManager) => {
      await entityManager.delete(RepositoryFilesEntity, {
        repositoryId: input.repositoryId,
      });

      if (input.files.length === 0) {
        return;
      }

      await entityManager.save(
        RepositoryFilesEntity,
        input.files.map((file) => {
          return entityManager.create(RepositoryFilesEntity, {
            path: file.path,
            rawAnalysisReport: file.sourceFile.decodedContent,
            repositoryId: input.repositoryId,
          });
        }),
      );
    });
  }

  private isEligibleRepositorySourceFile(sourceFile: RepositorySourceFileDto): boolean {
    if (sourceFile.encoding.toLowerCase() === 'base64') {
      return this.isEligibleBase64SourceFile(sourceFile.content);
    }

    if (!this.isWithinFileSizeLimit(Buffer.byteLength(sourceFile.decodedContent, 'utf-8'))) {
      return false;
    }

    return this.isTextLikeContent(sourceFile.decodedContent);
  }

  private isEligibleBase64SourceFile(base64Content: string): boolean {
    const rawBytes = Buffer.from(base64Content.replace(/\n/g, ''), 'base64');

    if (!this.isWithinFileSizeLimit(rawBytes.byteLength)) {
      return false;
    }

    let decodedText: string;

    try {
      decodedText = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
    } catch {
      return false;
    }

    return this.isTextLikeContent(decodedText);
  }

  private isWithinFileSizeLimit(sizeBytes: number): boolean {
    return sizeBytes <= this.maxFileSizeBytes;
  }

  private isTextLikeContent(content: string): boolean {
    if (content.length === 0) {
      return true;
    }

    if (content.includes('\u0000')) {
      return false;
    }

    let nonTextCharacters = 0;

    for (const char of content) {
      const charCode = char.charCodeAt(0);
      const isAllowedControlCharacter =
        charCode === 0x09 || charCode === 0x0a || charCode === 0x0d;
      const isAsciiPrintable = charCode >= 0x20 && charCode <= 0x7e;
      const isUnicodePrintable = charCode >= 0xa0;

      if (
        !isAllowedControlCharacter &&
        !isAsciiPrintable &&
        !isUnicodePrintable
      ) {
        nonTextCharacters += 1;
      }
    }

    return nonTextCharacters / content.length <= 0.3;
  }

  private async executeGitHubStep<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      throw this.toPipelineError(error);
    }
  }

  private toPipelineError(error: unknown): Error {
    if (!(error instanceof GitHubServiceError)) {
      return error instanceof Error
        ? error
        : new Error('Unknown GitHub processor error');
    }

    if (error.code === 'rate-limit') {
      return new Error(this.buildRateLimitFailureReason(error));
    }

    if (error.code === 'forbidden' || error.code === 'not-found') {
      return new Error(this.buildAccessDeniedFailureReason(error.code));
    }

    return error;
  }

  private buildAccessDeniedFailureReason(
    code: GitHubServiceError['code'],
  ): string {
    if (code === 'not-found') {
      return 'GITHUB_REPOSITORY_ACCESS_DENIED: repository not found or is private';
    }

    return 'GITHUB_REPOSITORY_ACCESS_DENIED: repository access forbidden';
  }

  private buildRateLimitFailureReason(error: GitHubServiceError): string {
    const remaining = error.rateLimit?.remaining ?? 'unknown';
    const resetAtEpochSeconds = error.rateLimit?.resetAtEpochSeconds;
    const resetAt =
      typeof resetAtEpochSeconds === 'number'
        ? new Date(resetAtEpochSeconds * 1000).toISOString()
        : null;
    const resetAtMessage = resetAt ? `, resets at ${resetAt}` : '';

    return `GITHUB_RATE_LIMIT_EXCEEDED: rate limit remaining ${remaining}${resetAtMessage}`;
  }
}
