import {
  AnalysisStage,
  GeneratedQuestionCategory,
  LlmMessageRole,
} from '@app/core';
import {
  AnalysisRunsEntity,
  CodeAnalysisEntity,
  GeneratedQuestionsEntity,
  LlmMessagesEntity,
  PromptTemplatesEntity,
} from '@app/database';
import {
  LlmParserService,
  LlmService,
  PromptBuilderService,
  type CodeSummaryReport,
  type GeneratedQuestionDraft,
} from '@app/integrations';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmAnalysisProcessor } from './llm-analysis.processor';

describe('LlmAnalysisProcessor', () => {
  let processor: LlmAnalysisProcessor;
  let configService: { get: jest.Mock };
  let llmParserService: {
    parseCodeSummary: jest.Mock;
    parseFileSelection: jest.Mock;
    parseGeneratedQuestions: jest.Mock;
  };
  let llmService: {
    generateQuestions: jest.Mock;
    selectFiles: jest.Mock;
    summarizeCode: jest.Mock;
  };
  let promptBuilderService: { buildPrompt: jest.Mock };
  let analysisRunsRepository: jest.Mocked<Repository<AnalysisRunsEntity>>;
  let codeAnalysisRepository: jest.Mocked<Repository<CodeAnalysisEntity>>;
  let generatedQuestionsRepository: jest.Mocked<Repository<GeneratedQuestionsEntity>> & {
    manager: {
      transaction: jest.Mock;
    };
  };
  let llmMessagesRepository: jest.Mocked<Repository<LlmMessagesEntity>>;
  let promptTemplatesRepository: jest.Mocked<Repository<PromptTemplatesEntity>>;

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    };
    llmParserService = {
      parseCodeSummary: jest.fn(),
      parseFileSelection: jest.fn(),
      parseGeneratedQuestions: jest.fn(),
    };
    llmService = {
      generateQuestions: jest.fn(),
      selectFiles: jest.fn(),
      summarizeCode: jest.fn(),
    };
    promptBuilderService = {
      buildPrompt: jest.fn(),
    };
    analysisRunsRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<AnalysisRunsEntity>>;
    codeAnalysisRepository = {
      create: jest.fn((value) => value),
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<CodeAnalysisEntity>>;

    const transaction = jest.fn();

    generatedQuestionsRepository = {
      manager: {
        transaction,
      },
    } as unknown as jest.Mocked<Repository<GeneratedQuestionsEntity>> & {
      manager: {
        transaction: jest.Mock;
      };
    };
    llmMessagesRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<LlmMessagesEntity>>;
    promptTemplatesRepository = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PromptTemplatesEntity>>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        LlmAnalysisProcessor,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: LlmParserService,
          useValue: llmParserService,
        },
        {
          provide: LlmService,
          useValue: llmService,
        },
        {
          provide: PromptBuilderService,
          useValue: promptBuilderService,
        },
        {
          provide: getRepositoryToken(AnalysisRunsEntity),
          useValue: analysisRunsRepository,
        },
        {
          provide: getRepositoryToken(CodeAnalysisEntity),
          useValue: codeAnalysisRepository,
        },
        {
          provide: getRepositoryToken(GeneratedQuestionsEntity),
          useValue: generatedQuestionsRepository,
        },
        {
          provide: getRepositoryToken(LlmMessagesEntity),
          useValue: llmMessagesRepository,
        },
        {
          provide: getRepositoryToken(PromptTemplatesEntity),
          useValue: promptTemplatesRepository,
        },
      ],
    }).compile();

    processor = moduleRef.get(LlmAnalysisProcessor);

    analysisRunsRepository.findOne.mockResolvedValue(
      createAnalysisRunContextEntity(),
    );
  });

  it('selects files with the built prompt and stores both llm messages', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'analysis.maxAnalysisFiles') {
        return 4;
      }

      return undefined;
    });
    promptTemplatesRepository.find.mockResolvedValue([
      createPromptTemplateEntity('file_selection'),
    ]);
    promptBuilderService.buildPrompt.mockReturnValue({
      prompt: 'prompt:file-selection',
      template: createPromptTemplateRecord('file_selection'),
    });
    llmService.selectFiles.mockResolvedValue({
      content: '["src/main.ts"]',
    });
    llmParserService.parseFileSelection.mockReturnValue(['src/main.ts']);

    const result = await processor.selectFiles({
      analysisRunId: 'run-1',
      filePaths: ['src/main.ts', 'src/app.ts'],
    });

    expect(promptTemplatesRepository.find).toHaveBeenCalledWith({
      order: { version: 'DESC' },
      where: {
        isActive: true,
        purpose: 'file_selection',
      },
    });
    expect(promptBuilderService.buildPrompt).toHaveBeenCalledWith({
      purpose: 'file_selection',
      templates: [createPromptTemplateRecord('file_selection')],
      variables: {
        default_branch: 'main',
        file_tree: 'src/main.ts\nsrc/app.ts',
        max_analysis_files: 4,
        repo_full_name: 'owner/repo',
        tech_stacks: JSON.stringify(['NestJS', 'PostgreSQL'], null, 2),
      },
    });
    expect(llmService.selectFiles).toHaveBeenCalledWith({
      maxAnalysisFiles: 4,
      prompt: 'prompt:file-selection',
    });
    expect(llmParserService.parseFileSelection).toHaveBeenCalledWith({
      content: '["src/main.ts"]',
      maxAnalysisFiles: 4,
    });
    expect(llmMessagesRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        analysisRunId: 'run-1',
        content: 'prompt:file-selection',
        role: LlmMessageRole.USER,
        stage: AnalysisStage.FOLDER_STRUCTURE,
      }),
    );
    expect(llmMessagesRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        analysisRunId: 'run-1',
        content: '["src/main.ts"]',
        role: LlmMessageRole.ASSISTANT,
        stage: AnalysisStage.FOLDER_STRUCTURE,
      }),
    );
    expect(result).toEqual(['src/main.ts']);
  });

  it('summarizes code and upserts the raw analysis report', async () => {
    const parsedReport = createCodeSummaryReport();

    promptTemplatesRepository.find.mockResolvedValue([
      createPromptTemplateEntity('code_summary'),
    ]);
    promptBuilderService.buildPrompt.mockReturnValue({
      prompt: 'prompt:code-summary',
      template: createPromptTemplateRecord('code_summary'),
    });
    llmService.summarizeCode.mockResolvedValue({
      content: '{"summary":"overall"}  ',
    });
    llmParserService.parseCodeSummary.mockReturnValue(parsedReport);
    codeAnalysisRepository.findOne.mockResolvedValue({
      id: 'analysis-1',
    } as CodeAnalysisEntity);

    const result = await processor.analyzeCode({
      analysisRunId: 'run-1',
      files: [
        {
          content: 'export const main = true;',
          path: 'src/main.ts',
        },
        {
          content: 'export const app = true;',
          path: 'src/app.ts',
        },
      ],
    });

    expect(promptBuilderService.buildPrompt).toHaveBeenCalledWith({
      purpose: 'code_summary',
      templates: [createPromptTemplateRecord('code_summary')],
      variables: {
        default_branch: 'main',
        file_contents: [
          'Path: src/main.ts',
          '```',
          'export const main = true;',
          '```',
          '',
          'Path: src/app.ts',
          '```',
          'export const app = true;',
          '```',
        ].join('\n'),
        repo_full_name: 'owner/repo',
        selected_files: 'src/main.ts\nsrc/app.ts',
        tech_stacks: JSON.stringify(['NestJS', 'PostgreSQL'], null, 2),
      },
    });
    expect(llmService.summarizeCode).toHaveBeenCalledWith({
      prompt: 'prompt:code-summary',
    });
    expect(llmParserService.parseCodeSummary).toHaveBeenCalledWith(
      '{"summary":"overall"}  ',
    );
    expect(codeAnalysisRepository.create).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      applicantId: 'applicant-1',
      id: 'analysis-1',
      rawAnalysisReport: '{"summary":"overall"}',
    });
    expect(codeAnalysisRepository.save).toHaveBeenCalledWith({
      analysisRunId: 'run-1',
      applicantId: 'applicant-1',
      id: 'analysis-1',
      rawAnalysisReport: '{"summary":"overall"}',
    });
    expect(llmMessagesRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        analysisRunId: 'run-1',
        content: 'prompt:code-summary',
        role: LlmMessageRole.USER,
        stage: AnalysisStage.SUMMARY,
      }),
    );
    expect(llmMessagesRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        analysisRunId: 'run-1',
        content: '{"summary":"overall"}  ',
        role: LlmMessageRole.ASSISTANT,
        stage: AnalysisStage.SUMMARY,
      }),
    );
    expect(result).toEqual(parsedReport);
  });

  it('generates questions, deduplicates by normalized text, and replaces stored rows', async () => {
    const parsedQuestions: GeneratedQuestionDraft[] = [
      {
        category: GeneratedQuestionCategory.SKILL,
        intent: 'Assess API design depth',
        priority: 3,
        questionText: 'How did you design this API?',
      },
      {
        category: GeneratedQuestionCategory.CULTURE_FIT,
        intent: 'Check collaboration style',
        priority: 1,
        questionText: '  how did you design this api? ',
      },
      {
        category: GeneratedQuestionCategory.CULTURE_FIT,
        intent: 'Check ownership',
        priority: 2,
        questionText: 'What trade-offs did you own here?',
      },
    ];
    const deleteMock = jest.fn();
    const saveMock = jest.fn();
    const createMock = jest.fn((_: unknown, value: unknown) => value);

    configService.get.mockImplementation((key: string) => {
      if (key === 'analysis.maxQuestionsPerAnalysisRun') {
        return 5;
      }

      return undefined;
    });
    promptTemplatesRepository.find.mockResolvedValue([
      createPromptTemplateEntity('question_generation'),
    ]);
    promptBuilderService.buildPrompt.mockReturnValue({
      prompt: 'prompt:question-generation',
      template: createPromptTemplateRecord('question_generation'),
    });
    codeAnalysisRepository.findOne.mockResolvedValue({
      rawAnalysisReport: '{"summary":"overall"}',
    } as CodeAnalysisEntity);
    llmService.generateQuestions.mockResolvedValue({
      content: '[{"questionText":"How did you design this API?"}]',
    });
    llmParserService.parseGeneratedQuestions.mockReturnValue(parsedQuestions);
    generatedQuestionsRepository.manager.transaction.mockImplementation(
      async (callback: (entityManager: {
        create: jest.Mock;
        delete: jest.Mock;
        save: jest.Mock;
      }) => Promise<void>) => {
        await callback({
          create: createMock,
          delete: deleteMock,
          save: saveMock,
        });
      },
    );

    const result = await processor.generateQuestions({
      analysisRunId: 'run-1',
    });

    expect(promptBuilderService.buildPrompt).toHaveBeenCalledWith({
      purpose: 'question_generation',
      templates: [createPromptTemplateRecord('question_generation')],
      variables: {
        code_analysis_json: '{"summary":"overall"}',
        culture_fit_priority: 'ownership',
        max_questions_per_analysis_run: 5,
        repo_full_name: 'owner/repo',
        tech_stacks: JSON.stringify(['NestJS', 'PostgreSQL'], null, 2),
      },
    });
    expect(llmService.generateQuestions).toHaveBeenCalledWith({
      maxQuestionsPerAnalysisRun: 5,
      prompt: 'prompt:question-generation',
    });
    expect(llmParserService.parseGeneratedQuestions).toHaveBeenCalledWith({
      content: '[{"questionText":"How did you design this API?"}]',
      maxQuestionsPerAnalysisRun: 5,
    });
    expect(deleteMock).toHaveBeenCalledWith(GeneratedQuestionsEntity, {
      analysisRunId: 'run-1',
    });
    expect(saveMock).toHaveBeenCalledWith(GeneratedQuestionsEntity, [
      {
        analysisRunId: 'run-1',
        applicantId: 'applicant-1',
        category: GeneratedQuestionCategory.SKILL,
        intent: 'Assess API design depth',
        priority: 3,
        questionText: 'How did you design this API?',
      },
      {
        analysisRunId: 'run-1',
        applicantId: 'applicant-1',
        category: GeneratedQuestionCategory.CULTURE_FIT,
        intent: 'Check ownership',
        priority: 2,
        questionText: 'What trade-offs did you own here?',
      },
    ]);
    expect(result).toEqual([
      {
        category: GeneratedQuestionCategory.SKILL,
        intent: 'Assess API design depth',
        priority: 3,
        questionText: 'How did you design this API?',
      },
      {
        category: GeneratedQuestionCategory.CULTURE_FIT,
        intent: 'Check ownership',
        priority: 2,
        questionText: 'What trade-offs did you own here?',
      },
    ]);
  });

  it('fails fast when question generation starts without a saved code analysis', async () => {
    codeAnalysisRepository.findOne.mockResolvedValue(null);

    await expect(
      processor.generateQuestions({
        analysisRunId: 'run-1',
      }),
    ).rejects.toThrow('Code analysis not found for analysis run: run-1');

    expect(promptBuilderService.buildPrompt).not.toHaveBeenCalled();
    expect(llmService.generateQuestions).not.toHaveBeenCalled();
  });
});

function createAnalysisRunContextEntity(): AnalysisRunsEntity {
  return {
    applicant: {
      group: {
        cultureFitPriority: 'ownership',
        techStacks: ['NestJS', 'PostgreSQL'],
      },
    },
    applicantId: 'applicant-1',
    id: 'run-1',
    repository: {
      defaultBranch: 'main',
      repoFullName: 'owner/repo',
    },
  } as unknown as AnalysisRunsEntity;
}

function createPromptTemplateEntity(purpose: string): PromptTemplatesEntity {
  return {
    id: 1,
    isActive: true,
    purpose,
    templateKey: `${purpose}-template`,
    templateName: `${purpose} template`,
    templateText: `template for ${purpose}`,
    variablesJson: {
      repo_full_name: 'string',
    },
    version: 1,
  } as unknown as PromptTemplatesEntity;
}

function createPromptTemplateRecord(purpose: string): {
  id: number;
  isActive: boolean;
  purpose: string;
  templateKey: string;
  templateName: string;
  templateText: string;
  variablesJson: {
    repo_full_name: 'string';
  };
  version: number;
} {
  return {
    id: 1,
    isActive: true,
    purpose,
    templateKey: `${purpose}-template`,
    templateName: `${purpose} template`,
    templateText: `template for ${purpose}`,
    variablesJson: {
      repo_full_name: 'string',
    },
    version: 1,
  };
}

function createCodeSummaryReport(): CodeSummaryReport {
  return {
    architecture: {
      evidence: ['src/main.ts'],
      pattern: 'modular',
    },
    collaborationSignals: [
      {
        evidence: ['README.md'],
        signal: 'clear ownership',
      },
    ],
    recommendedQuestionAreas: {
      cultureFit: ['ownership'],
      skill: ['nestjs modules'],
    },
    risks: [
      {
        evidence: ['src/app.ts'],
        point: 'missing retry logic',
      },
    ],
    strengths: [
      {
        evidence: ['src/main.ts'],
        point: 'clear module boundaries',
      },
    ],
    summary: 'overall summary',
    technicalDecisions: [
      {
        assessment: 'reasonable trade-off',
        evidence: ['src/app.ts'],
        topic: 'dependency injection',
      },
    ],
  };
}
