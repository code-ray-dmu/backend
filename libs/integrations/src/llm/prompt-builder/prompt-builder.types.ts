export type PromptTemplatePurpose =
  | 'file_selection'
  | 'code_summary'
  | 'question_generation';

export type PromptTemplateVariableType =
  | 'boolean'
  | 'json'
  | 'number'
  | 'string';

export interface PromptTemplateRecord {
  id?: number;
  isActive: boolean;
  purpose: string;
  templateKey: string;
  templateName: string;
  templateText: string;
  variablesJson?: Record<string, PromptTemplateVariableType> | null;
  version: number;
}

export interface BuildPromptInput {
  purpose: PromptTemplatePurpose;
  templates: PromptTemplateRecord[];
  variables: Record<string, unknown>;
}

export interface BuildPromptResult {
  prompt: string;
  template: PromptTemplateRecord;
}
