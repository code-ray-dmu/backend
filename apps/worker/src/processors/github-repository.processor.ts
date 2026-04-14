import {
  AnalysisRunsEntity,
  ApplicantRepositoriesEntity,
  RepositoryFilesEntity,
} from '@app/database';
import {
  GitHubService,
  type RepositoryMetadataDto,
  type RepositorySourceFileDto,
} from '@app/integrations';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class GithubRepositoryProcessor {
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
    const repositoryInfo = await this.gitHubService.getRepositoryMetadata({
      repoFullName: analysisRun.repository.repoFullName,
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
    const repositoryTree = await this.gitHubService.getRepositoryTree({
      repoFullName: analysisRun.repository.repoFullName,
      branch: input.defaultBranch,
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
    const files = await Promise.all(
      input.selectedPaths.map(async (path) => {
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

    await this.replaceRepositoryFiles({
      files,
      repositoryId: analysisRun.repositoryId,
    });

    return files.map((file) => {
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
}
