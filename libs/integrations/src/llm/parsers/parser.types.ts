import type { GeneratedQuestionCategory } from '@app/core';

export interface CodeSummaryEvidenceGroup {
  evidence: string[];
}

export interface CodeSummaryArchitecture extends CodeSummaryEvidenceGroup {
  pattern: string;
}

export interface CodeSummaryTechnicalDecision extends CodeSummaryEvidenceGroup {
  assessment: string;
  topic: string;
}

export interface CodeSummaryStrength extends CodeSummaryEvidenceGroup {
  point: string;
}

export interface CodeSummaryRisk extends CodeSummaryEvidenceGroup {
  point: string;
}

export interface CodeSummaryCollaborationSignal extends CodeSummaryEvidenceGroup {
  signal: string;
}

export interface CodeSummaryRecommendedQuestionAreas {
  cultureFit: string[];
  skill: string[];
}

export interface CodeSummaryReport {
  architecture: CodeSummaryArchitecture;
  collaborationSignals: CodeSummaryCollaborationSignal[];
  recommendedQuestionAreas: CodeSummaryRecommendedQuestionAreas;
  risks: CodeSummaryRisk[];
  strengths: CodeSummaryStrength[];
  summary: string;
  technicalDecisions: CodeSummaryTechnicalDecision[];
}

export interface ParseFileSelectionInput {
  content: string;
  maxAnalysisFiles: number;
}

export interface ParseGeneratedQuestionsInput {
  content: string;
  maxQuestionsPerAnalysisRun: number;
}

export interface GeneratedQuestionDraft {
  category: GeneratedQuestionCategory;
  intent: string;
  priority: number;
  questionText: string;
}
