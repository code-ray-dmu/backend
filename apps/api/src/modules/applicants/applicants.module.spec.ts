import 'reflect-metadata';

import { MODULE_METADATA } from '@nestjs/common/constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubModule } from '@app/integrations';
import { AnalysisRunsModule } from '../analysis-runs/analysis-runs.module';
import { AuthModule } from '../auth/auth.module';
import { GeneratedQuestionsModule } from '../generated-questions/generated-questions.module';
import { GroupsModule } from '../groups/groups.module';
import { ApplicantGithubReposService } from './applicant-github-repos.service';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsModule } from './applicants.module';
import { ApplicantsService } from './applicants.service';
import { ApplicantsRepository } from './repositories/applicants.repository';

describe('ApplicantsModule', () => {
  it('wires applicants dependencies for later tasks', (): void => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ApplicantsModule) as unknown[];
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ApplicantsModule) as unknown[];
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      ApplicantsModule,
    ) as unknown[];
    const exportsMetadata = Reflect.getMetadata(MODULE_METADATA.EXPORTS, ApplicantsModule) as unknown[];

    const typeOrmImport = imports.find(
      (importMetadata) =>
        typeof importMetadata === 'object' &&
        importMetadata !== null &&
        'module' in importMetadata &&
        importMetadata.module === TypeOrmModule,
    ) as {
      providers?: Array<{ provide?: string }>;
    } | undefined;

    expect(typeOrmImport?.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: 'ApplicantsEntityRepository',
        }),
      ]),
    );
    expect(imports).toEqual(
      expect.arrayContaining([
        AuthModule,
        GroupsModule,
        AnalysisRunsModule,
        GeneratedQuestionsModule,
        GitHubModule,
      ]),
    );
    expect(providers).toEqual(
      expect.arrayContaining([
        ApplicantGithubReposService,
        ApplicantsService,
        ApplicantsFacade,
        ApplicantsRepository,
      ]),
    );
    expect(controllers).toEqual(expect.arrayContaining([ApplicantsController]));
    expect(exportsMetadata).toEqual(
      expect.arrayContaining([
        ApplicantGithubReposService,
        ApplicantsService,
        ApplicantsFacade,
        ApplicantsRepository,
      ]),
    );
  });
});
