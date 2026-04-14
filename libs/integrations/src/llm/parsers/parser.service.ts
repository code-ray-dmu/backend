import { GeneratedQuestionCategory } from '@app/core';
import { Injectable } from '@nestjs/common';
import {
  LLM_RESPONSE_PARSE_FAILED,
  LlmParserError,
} from './parser.errors';
import type {
  CodeSummaryArchitecture,
  CodeSummaryCollaborationSignal,
  CodeSummaryRecommendedQuestionAreas,
  CodeSummaryReport,
  CodeSummaryRisk,
  CodeSummaryStrength,
  CodeSummaryTechnicalDecision,
  GeneratedQuestionDraft,
  ParseFileSelectionInput,
  ParseGeneratedQuestionsInput,
} from './parser.types';

@Injectable()
export class LlmParserService {
  parseCodeSummary(content: string): CodeSummaryReport {
    const parsed = this.parseJson(content, 'code_summary');

    if (!this.isRecord(parsed)) {
      this.throwParseFailed('code_summary', 'root must be an object');
    }

    return {
      architecture: this.parseArchitecture(parsed.architecture),
      collaborationSignals: this.parseCollaborationSignals(
        parsed.collaborationSignals,
      ),
      recommendedQuestionAreas: this.parseRecommendedQuestionAreas(
        parsed.recommendedQuestionAreas,
      ),
      risks: this.parseRisks(parsed.risks),
      strengths: this.parseStrengths(parsed.strengths),
      summary: this.parseRequiredString(parsed.summary, 'code_summary.summary'),
      technicalDecisions: this.parseTechnicalDecisions(
        parsed.technicalDecisions,
      ),
    };
  }

  parseFileSelection(input: ParseFileSelectionInput): string[] {
    const parsed = this.parseJson(input.content, 'file_selection');

    if (!Array.isArray(parsed)) {
      this.throwParseFailed('file_selection', 'root must be an array');
    }

    const paths = [
      ...new Set(
        this.normalizeStringArray(parsed).filter((path) => path.length > 0),
      ),
    ].slice(0, input.maxAnalysisFiles);

    if (paths.length === 0) {
      this.throwParseFailed('file_selection', 'no valid file paths');
    }

    return paths;
  }

  parseGeneratedQuestions(
    input: ParseGeneratedQuestionsInput,
  ): GeneratedQuestionDraft[] {
    const parsed = this.parseJson(input.content, 'question_generation');

    if (!Array.isArray(parsed)) {
      this.throwParseFailed('question_generation', 'root must be an array');
    }

    const questions = parsed
      .map((item, index) => {
        const normalized = this.normalizeQuestion(item);

        if (!normalized) {
          return null;
        }

        return {
          ...normalized,
          originalIndex: index,
        };
      })
      .filter((question) => question !== null)
      .sort((left, right) => {
        if (left.priority === right.priority) {
          return left.originalIndex - right.originalIndex;
        }

        return left.priority - right.priority;
      })
      .slice(0, input.maxQuestionsPerAnalysisRun)
      .map(({ originalIndex: _, ...question }) => question);

    if (questions.length === 0) {
      this.throwParseFailed(
        'question_generation',
        'no valid generated questions',
      );
    }

    return questions;
  }

  private parseArchitecture(value: unknown): CodeSummaryArchitecture {
    if (!this.isRecord(value)) {
      this.throwParseFailed('code_summary', 'architecture must be an object');
    }

    if (!Array.isArray(value.evidence)) {
      this.throwParseFailed(
        'code_summary',
        'architecture.evidence must be an array',
      );
    }

    const evidence = this.normalizeStringArray(value.evidence);

    if (evidence.length === 0) {
      this.throwParseFailed(
        'code_summary',
        'architecture.evidence must include at least one item',
      );
    }

    return {
      evidence,
      pattern: this.parseRequiredString(
        value.pattern,
        'code_summary.architecture.pattern',
      ),
    };
  }

  private parseCollaborationSignals(
    value: unknown,
  ): CodeSummaryCollaborationSignal[] {
    if (!Array.isArray(value)) {
      this.throwParseFailed(
        'code_summary',
        'collaborationSignals must be an array',
      );
    }

    return value.flatMap((entry) => {
      const normalized = this.normalizeEvidenceEntry(entry, 'signal');

      return normalized ? [normalized] : [];
    });
  }

  private parseRecommendedQuestionAreas(
    value: unknown,
  ): CodeSummaryRecommendedQuestionAreas {
    if (!this.isRecord(value)) {
      this.throwParseFailed(
        'code_summary',
        'recommendedQuestionAreas must be an object',
      );
    }

    return {
      cultureFit: this.parseStringArrayField(
        value.cultureFit,
        'code_summary.recommendedQuestionAreas.cultureFit',
      ),
      skill: this.parseStringArrayField(
        value.skill,
        'code_summary.recommendedQuestionAreas.skill',
      ),
    };
  }

  private parseRisks(value: unknown): CodeSummaryRisk[] {
    if (!Array.isArray(value)) {
      this.throwParseFailed('code_summary', 'risks must be an array');
    }

    return value.flatMap((entry) => {
      const normalized = this.normalizeEvidenceEntry(entry, 'point');

      return normalized ? [normalized] : [];
    });
  }

  private parseStrengths(value: unknown): CodeSummaryStrength[] {
    if (!Array.isArray(value)) {
      this.throwParseFailed('code_summary', 'strengths must be an array');
    }

    return value.flatMap((entry) => {
      const normalized = this.normalizeEvidenceEntry(entry, 'point');

      return normalized ? [normalized] : [];
    });
  }

  private parseTechnicalDecisions(
    value: unknown,
  ): CodeSummaryTechnicalDecision[] {
    if (!Array.isArray(value)) {
      this.throwParseFailed(
        'code_summary',
        'technicalDecisions must be an array',
      );
    }

    return value.flatMap((entry) => {
      if (!this.isRecord(entry)) {
        return [];
      }

      if (!Array.isArray(entry.evidence)) {
        return [];
      }

      const evidence = this.normalizeStringArray(entry.evidence);
      const topic = this.readOptionalString(entry.topic);
      const assessment = this.readOptionalString(entry.assessment);

      if (!topic || !assessment || evidence.length === 0) {
        return [];
      }

      return [
        {
          assessment,
          evidence,
          topic,
        },
      ];
    });
  }

  private normalizeEvidenceEntry<TField extends 'point' | 'signal'>(
    value: unknown,
    field: TField,
  ): ({ evidence: string[] } & Record<TField, string>) | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const text = this.readOptionalString(value[field]);
    if (!Array.isArray(value.evidence)) {
      return null;
    }

    const evidence = this.normalizeStringArray(value.evidence);

    if (!text || evidence.length === 0) {
      return null;
    }

    return {
      evidence,
      [field]: text,
    } as { evidence: string[] } & Record<TField, string>;
  }

  private normalizeQuestion(value: unknown): GeneratedQuestionDraft | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const category = this.parseQuestionCategory(value.category);
    const questionText = this.readOptionalString(value.questionText);
    const intent = this.readOptionalString(value.intent);
    const priority = this.parsePriority(value.priority);

    if (!category || !questionText || !intent || priority === null) {
      return null;
    }

    return {
      category,
      intent,
      priority,
      questionText,
    };
  }

  private parseQuestionCategory(
    value: unknown,
  ): GeneratedQuestionCategory | null {
    if (
      value === GeneratedQuestionCategory.CULTURE_FIT ||
      value === GeneratedQuestionCategory.SKILL
    ) {
      return value;
    }

    return null;
  }

  private parsePriority(value: unknown): number | null {
    if (value === undefined) {
      return 0;
    }

    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return null;
    }

    return value;
  }

  private parseStringArrayField(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value)) {
      this.throwParseFailed('code_summary', `${fieldName} must be an array`);
    }

    return this.normalizeStringArray(value);
  }

  private parseRequiredString(value: unknown, fieldName: string): string {
    const normalized = this.readOptionalString(value);

    if (!normalized) {
      this.throwParseFailed('code_summary', `${fieldName} must be a string`);
    }

    return normalized;
  }

  private normalizeStringArray(values: unknown[]): string[] {
    return values.flatMap((value) => {
      const normalized = this.readOptionalString(value);

      return normalized ? [normalized] : [];
    });
  }

  private readOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    return trimmed;
  }

  private parseJson(content: string, stage: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';

      this.throwParseFailed(stage, detail);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private throwParseFailed(stage: string, detail: string): never {
    throw new LlmParserError(
      `${LLM_RESPONSE_PARSE_FAILED}: stage=${stage} detail=${detail}`,
    );
  }
}
