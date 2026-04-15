import { AnalysisStage, LlmMessageRole } from '@app/core';
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
  type PromptTemplateRecord,
  type PromptTemplatePurpose,
  type PromptTemplateVariableType,
} from '@app/integrations';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface SelectFilesProcessorInput {
  analysisRunId: string;
  filePaths: string[];
}

export interface AnalyzeCodeFileInput {
  content: string;
  path: string;
}

export interface AnalyzeCodeProcessorInput {
  analysisRunId: string;
  files: AnalyzeCodeFileInput[];
}

export interface GenerateQuestionsProcessorInput {
  analysisRunId: string;
}

interface AnalysisRunLlmContext {
  analysisRun: AnalysisRunsEntity;
  cultureFitPriority: string;
  defaultBranch: string;
  repoFullName: string;
  techStacks: string;
}

@Injectable()
export class LlmAnalysisProcessor {
  constructor(
    private readonly configService: ConfigService,
    private readonly llmParserService: LlmParserService,
    private readonly llmService: LlmService,
    private readonly promptBuilderService: PromptBuilderService,
    @InjectRepository(AnalysisRunsEntity)
    private readonly analysisRunsRepository: Repository<AnalysisRunsEntity>,
    @InjectRepository(CodeAnalysisEntity)
    private readonly codeAnalysisRepository: Repository<CodeAnalysisEntity>,
    @InjectRepository(GeneratedQuestionsEntity)
    private readonly generatedQuestionsRepository: Repository<GeneratedQuestionsEntity>,
    @InjectRepository(LlmMessagesEntity)
    private readonly llmMessagesRepository: Repository<LlmMessagesEntity>,
    @InjectRepository(PromptTemplatesEntity)
    private readonly promptTemplatesRepository: Repository<PromptTemplatesEntity>,
  ) {}

  async selectFiles(input: SelectFilesProcessorInput): Promise<string[]> {
    const context = await this.getAnalysisRunContext(input.analysisRunId);
    const maxAnalysisFiles = this.getMaxAnalysisFiles();
    const prompt = await this.buildPrompt({
      purpose: 'file_selection',
      variables: {
        default_branch: context.defaultBranch,
        file_tree: input.filePaths.join('\n'),
        max_analysis_files: maxAnalysisFiles,
        repo_full_name: context.repoFullName,
        tech_stacks: context.techStacks,
      },
    });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: prompt,
      role: LlmMessageRole.USER,
      stage: AnalysisStage.FOLDER_STRUCTURE,
    });

    const response = await this.llmService.selectFiles({
      maxAnalysisFiles,
      prompt,
    });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: response.content,
      role: LlmMessageRole.ASSISTANT,
      stage: AnalysisStage.FOLDER_STRUCTURE,
    });

    return this.llmParserService.parseFileSelection({
      content: response.content,
      maxAnalysisFiles,
    });
  }

  async analyzeCode(input: AnalyzeCodeProcessorInput): Promise<CodeSummaryReport> {
    const context = await this.getAnalysisRunContext(input.analysisRunId);
    const prompt = await this.buildPrompt({
      purpose: 'code_summary',
      variables: {
        default_branch: context.defaultBranch,
        file_contents: this.formatFileContents(input.files),
        repo_full_name: context.repoFullName,
        selected_files: input.files.map((file) => file.path).join('\n'),
        tech_stacks: context.techStacks,
      },
    });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: prompt,
      role: LlmMessageRole.USER,
      stage: AnalysisStage.SUMMARY,
    });

    const response = await this.llmService.summarizeCode({ prompt });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: response.content,
      role: LlmMessageRole.ASSISTANT,
      stage: AnalysisStage.SUMMARY,
    });

    const parsedReport = this.llmParserService.parseCodeSummary(response.content);
    const existingCodeAnalysis = await this.codeAnalysisRepository.findOne({
      where: { analysisRunId: input.analysisRunId },
    });

    await this.codeAnalysisRepository.save(
      this.codeAnalysisRepository.create({
        analysisRunId: input.analysisRunId,
        applicantId: context.analysisRun.applicantId,
        id: existingCodeAnalysis?.id,
        rawAnalysisReport: response.content,
      }),
    );

    return parsedReport;
  }

  async generateQuestions(
    input: GenerateQuestionsProcessorInput,
  ): Promise<GeneratedQuestionDraft[]> {
    const context = await this.getAnalysisRunContext(input.analysisRunId);
    const codeAnalysis = await this.codeAnalysisRepository.findOne({
      where: { analysisRunId: input.analysisRunId },
    });

    if (!codeAnalysis) {
      throw new Error(
        `Code analysis not found for analysis run: ${input.analysisRunId}`,
      );
    }

    const maxQuestionsPerAnalysisRun = this.getMaxQuestionsPerAnalysisRun();
    const prompt = await this.buildPrompt({
      purpose: 'question_generation',
      variables: {
        code_analysis_json: codeAnalysis.rawAnalysisReport,
        culture_fit_priority: context.cultureFitPriority,
        max_questions_per_analysis_run: maxQuestionsPerAnalysisRun,
        repo_full_name: context.repoFullName,
        tech_stacks: context.techStacks,
      },
    });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: prompt,
      role: LlmMessageRole.USER,
      stage: AnalysisStage.QUESTION_GENERATION,
    });

    const response = await this.llmService.generateQuestions({
      maxQuestionsPerAnalysisRun,
      prompt,
    });

    await this.saveLlmMessage({
      analysisRunId: input.analysisRunId,
      content: response.content,
      role: LlmMessageRole.ASSISTANT,
      stage: AnalysisStage.QUESTION_GENERATION,
    });

    const parsedQuestions = this.llmParserService.parseGeneratedQuestions({
      content: response.content,
      maxQuestionsPerAnalysisRun: Number.MAX_SAFE_INTEGER,
    });
    const normalizedQuestions = this.normalizeQuestionsForPersistence(
      parsedQuestions,
      maxQuestionsPerAnalysisRun,
    );

    await this.generatedQuestionsRepository.manager.transaction(
      async (entityManager) => {
        await entityManager.delete(GeneratedQuestionsEntity, {
          analysisRunId: input.analysisRunId,
        });
        await entityManager.save(
          GeneratedQuestionsEntity,
          normalizedQuestions.map((question) => {
            return entityManager.create(GeneratedQuestionsEntity, {
              analysisRunId: input.analysisRunId,
              applicantId: context.analysisRun.applicantId,
              category: question.category,
              intent: question.intent,
              priority: question.priority,
              questionText: question.questionText,
            });
          }),
        );
      },
    );

    return normalizedQuestions;
  }

  private async buildPrompt(input: {
    purpose: PromptTemplatePurpose;
    variables: Record<string, unknown>;
  }): Promise<string> {
    const templates = await this.promptTemplatesRepository.find({
      order: { version: 'DESC' },
      where: {
        isActive: true,
        purpose: input.purpose,
      },
    });

    const promptTemplates = templates.map((template) => {
      return this.toPromptTemplateRecord(template);
    });

    return this.promptBuilderService.buildPrompt({
      purpose: input.purpose,
      templates: promptTemplates,
      variables: input.variables,
    }).prompt;
  }

  private normalizeQuestionsForPersistence(
    questions: GeneratedQuestionDraft[],
    maxQuestionsPerAnalysisRun: number,
  ): GeneratedQuestionDraft[] {
    const normalizedQuestions = new Map<string, GeneratedQuestionDraft>();

    for (const question of questions) {
      const dedupeKey = question.questionText.trim().toLocaleLowerCase();
      const existingQuestion = normalizedQuestions.get(dedupeKey);

      if (!existingQuestion || question.priority < existingQuestion.priority) {
        normalizedQuestions.set(dedupeKey, question);
      }
    }

    return [...normalizedQuestions.values()]
      .sort((left, right) => left.priority - right.priority)
      .slice(0, maxQuestionsPerAnalysisRun);
  }

  private formatFileContents(files: AnalyzeCodeFileInput[]): string {
    return files
      .map((file) => {
        return [`Path: ${file.path}`, '```', file.content, '```'].join('\n');
      })
      .join('\n\n');
  }

  private async getAnalysisRunContext(
    analysisRunId: string,
  ): Promise<AnalysisRunLlmContext> {
    const analysisRun = await this.analysisRunsRepository.findOne({
      relations: {
        applicant: {
          group: true,
        },
        repository: true,
      },
      where: {
        id: analysisRunId,
      },
    });

    if (!analysisRun?.repository || !analysisRun.applicant?.group) {
      throw new Error(`Analysis run context not found: ${analysisRunId}`);
    }

    return {
      analysisRun,
      cultureFitPriority: analysisRun.applicant.group.cultureFitPriority,
      defaultBranch: analysisRun.repository.defaultBranch ?? 'unknown',
      repoFullName: analysisRun.repository.repoFullName,
      techStacks: JSON.stringify(analysisRun.applicant.group.techStacks, null, 2),
    };
  }

  private getMaxAnalysisFiles(): number {
    return this.configService.get<number>('analysis.maxAnalysisFiles') ?? 10;
  }

  private getMaxQuestionsPerAnalysisRun(): number {
    return (
      this.configService.get<number>('analysis.maxQuestionsPerAnalysisRun') ?? 3
    );
  }

  private async saveLlmMessage(input: {
    analysisRunId: string;
    content: string;
    role: LlmMessageRole;
    stage: AnalysisStage;
  }): Promise<void> {
    await this.llmMessagesRepository.save(
      this.llmMessagesRepository.create({
        analysisRunId: input.analysisRunId,
        content: input.content,
        role: input.role,
        stage: input.stage,
      }),
    );
  }

  private toPromptTemplateRecord(
    template: PromptTemplatesEntity,
  ): PromptTemplateRecord {
    return {
      id: template.id,
      isActive: template.isActive,
      purpose: template.purpose,
      templateKey: template.templateKey,
      templateName: template.templateName,
      templateText: template.templateText,
      variablesJson: this.toPromptTemplateVariables(template.variablesJson),
      version: template.version,
    };
  }

  private toPromptTemplateVariables(
    value?: Record<string, unknown>,
  ): Record<string, PromptTemplateVariableType> | null {
    if (!value) {
      return null;
    }

    const normalizedVariables: Record<string, PromptTemplateVariableType> = {};

    for (const [key, variableType] of Object.entries(value)) {
      if (
        variableType === 'boolean' ||
        variableType === 'json' ||
        variableType === 'number' ||
        variableType === 'string'
      ) {
        normalizedVariables[key] = variableType;
      }
    }

    return normalizedVariables;
  }
}
