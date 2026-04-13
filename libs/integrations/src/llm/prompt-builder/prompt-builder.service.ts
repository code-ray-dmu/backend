import { Injectable } from '@nestjs/common';
import {
  PROMPT_TEMPLATE_ACTIVE_AMBIGUOUS,
  PROMPT_TEMPLATE_NOT_FOUND,
  PROMPT_TEMPLATE_VARIABLE_MISSING,
  PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID,
  PROMPT_TEMPLATE_VARIABLE_UNDECLARED,
  PromptBuilderError,
} from './prompt-builder.errors';
import type {
  BuildPromptInput,
  BuildPromptResult,
  PromptTemplatePurpose,
  PromptTemplateRecord,
  PromptTemplateVariableType,
} from './prompt-builder.types';

const TEMPLATE_VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

@Injectable()
export class PromptBuilderService {
  buildPrompt(input: BuildPromptInput): BuildPromptResult {
    const template = this.selectActiveTemplate(input.templates, input.purpose);
    const declaredVariables = this.getDeclaredVariables(template);

    this.validateDeclaredVariables({
      purpose: input.purpose,
      template,
      variables: input.variables,
    });
    this.validateTemplatePlaceholders({
      declaredVariables,
      purpose: input.purpose,
      template,
    });

    return {
      prompt: this.replaceVariables(template.templateText, input.variables),
      template,
    };
  }

  selectActiveTemplate(
    templates: PromptTemplateRecord[],
    purpose: PromptTemplatePurpose,
  ): PromptTemplateRecord {
    const activeTemplates = templates.filter((template) => {
      return template.isActive && template.purpose === purpose;
    });

    if (activeTemplates.length === 0) {
      throw new PromptBuilderError(
        `${PROMPT_TEMPLATE_NOT_FOUND}: purpose=${purpose}`,
      );
    }

    if (activeTemplates.length > 1) {
      throw new PromptBuilderError(
        `${PROMPT_TEMPLATE_ACTIVE_AMBIGUOUS}: purpose=${purpose} count=${activeTemplates.length}`,
      );
    }

    return activeTemplates[0];
  }

  private getDeclaredVariables(
    template: PromptTemplateRecord,
  ): Record<string, PromptTemplateVariableType> {
    return template.variablesJson ?? {};
  }

  private validateDeclaredVariables(input: {
    purpose: PromptTemplatePurpose;
    template: PromptTemplateRecord;
    variables: Record<string, unknown>;
  }): void {
    const declaredVariables = this.getDeclaredVariables(input.template);

    for (const [variableName, expectedType] of Object.entries(declaredVariables)) {
      if (!(variableName in input.variables)) {
        throw new PromptBuilderError(
          `${PROMPT_TEMPLATE_VARIABLE_MISSING}: purpose=${input.purpose} variable=${variableName}`,
        );
      }

      const value = input.variables[variableName];

      if (!this.isExpectedType(value, expectedType)) {
        throw new PromptBuilderError(
          `${PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID}: purpose=${input.purpose} variable=${variableName} expected=${expectedType}`,
        );
      }
    }
  }

  private validateTemplatePlaceholders(input: {
    declaredVariables: Record<string, PromptTemplateVariableType>;
    purpose: PromptTemplatePurpose;
    template: PromptTemplateRecord;
  }): void {
    const placeholderNames = this.getPlaceholderNames(input.template.templateText);

    for (const placeholderName of placeholderNames) {
      if (!(placeholderName in input.declaredVariables)) {
        throw new PromptBuilderError(
          `${PROMPT_TEMPLATE_VARIABLE_UNDECLARED}: purpose=${input.purpose} variable=${placeholderName}`,
        );
      }
    }
  }

  private getPlaceholderNames(templateText: string): Set<string> {
    const placeholderNames = new Set<string>();

    for (const match of templateText.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
      const variableName = match[1];

      if (variableName) {
        placeholderNames.add(variableName);
      }
    }

    return placeholderNames;
  }

  private replaceVariables(
    templateText: string,
    variables: Record<string, unknown>,
  ): string {
    return templateText.replaceAll(TEMPLATE_VARIABLE_PATTERN, (_, key: string) => {
      const value = variables[key];

      return this.toPromptValue(value);
    });
  }

  private isExpectedType(
    value: unknown,
    expectedType: PromptTemplateVariableType,
  ): boolean {
    if (expectedType === 'string') {
      return typeof value === 'string';
    }

    if (expectedType === 'number') {
      return typeof value === 'number' && Number.isFinite(value);
    }

    if (expectedType === 'boolean') {
      return typeof value === 'boolean';
    }

    if (expectedType === 'json') {
      return this.isJsonSerializable(value);
    }

    throw new PromptBuilderError(
      `${PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID}: unsupported declaration expected=${expectedType}`,
    );
  }

  private toPromptValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return JSON.stringify(value);
  }

  private isJsonSerializable(value: unknown): boolean {
    if (value === undefined) {
      return false;
    }

    try {
      JSON.stringify(value);

      return true;
    } catch {
      return false;
    }
  }
}
