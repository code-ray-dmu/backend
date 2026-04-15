import { PromptBuilderService } from './prompt-builder.service';
import type { PromptTemplateRecord } from './prompt-builder.types';
import {
  PROMPT_TEMPLATE_ACTIVE_AMBIGUOUS,
  PROMPT_TEMPLATE_NOT_FOUND,
  PROMPT_TEMPLATE_VARIABLE_MISSING,
  PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID,
  PROMPT_TEMPLATE_VARIABLE_UNDECLARED,
  PromptBuilderError,
} from './prompt-builder.errors';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('builds a prompt from the single active template for a purpose', () => {
    const result = service.buildPrompt({
      purpose: 'file_selection',
      templates: [
        createTemplate({
          purpose: 'file_selection',
          templateText:
            'repo={{repo_full_name}} max={{ max_analysis_files }} tree={{file_tree}}',
          variablesJson: {
            file_tree: 'string',
            max_analysis_files: 'number',
            repo_full_name: 'string',
          },
        }),
      ],
      variables: {
        file_tree: 'src/main.ts',
        max_analysis_files: 5,
        repo_full_name: 'openai/code-ray',
      },
    });

    expect(result.prompt).toBe(
      'repo=openai/code-ray max=5 tree=src/main.ts',
    );
    expect(result.template.purpose).toBe('file_selection');
  });

  it.each(['file_selection', 'code_summary', 'question_generation'] as const)(
    'throws %s not-found identifier when no active template exists',
    (purpose) => {
      expect(() => {
        service.buildPrompt({
          purpose,
          templates: [
            createTemplate({
              isActive: false,
              purpose,
            }),
          ],
          variables: {},
        });
      }).toThrow(
        new PromptBuilderError(`${PROMPT_TEMPLATE_NOT_FOUND}: purpose=${purpose}`),
      );
    },
  );

  it.each(['file_selection', 'code_summary', 'question_generation'] as const)(
    'throws %s ambiguous identifier when multiple active templates exist',
    (purpose) => {
      expect(() => {
        service.buildPrompt({
          purpose,
          templates: [
            createTemplate({ purpose, templateKey: 'a' }),
            createTemplate({ purpose, templateKey: 'b' }),
          ],
          variables: {},
        });
      }).toThrow(
        new PromptBuilderError(
          `${PROMPT_TEMPLATE_ACTIVE_AMBIGUOUS}: purpose=${purpose} count=2`,
        ),
      );
    },
  );

  it('throws when a declared variable is missing', () => {
    expect(() => {
      service.buildPrompt({
        purpose: 'code_summary',
        templates: [
          createTemplate({
            purpose: 'code_summary',
            templateText: 'repo={{repo_full_name}}',
            variablesJson: {
              repo_full_name: 'string',
            },
          }),
        ],
        variables: {},
      });
    }).toThrow(
      new PromptBuilderError(
        `${PROMPT_TEMPLATE_VARIABLE_MISSING}: purpose=code_summary variable=repo_full_name`,
      ),
    );
  });

  it('throws when a declared variable has the wrong primitive type', () => {
    expect(() => {
      service.buildPrompt({
        purpose: 'file_selection',
        templates: [
          createTemplate({
            purpose: 'file_selection',
            templateText: 'max={{max_analysis_files}}',
            variablesJson: {
              max_analysis_files: 'number',
            },
          }),
        ],
        variables: {
          max_analysis_files: '3',
        },
      });
    }).toThrow(
      new PromptBuilderError(
        `${PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID}: purpose=file_selection variable=max_analysis_files expected=number`,
      ),
    );
  });

  it('throws when template text references an undeclared variable', () => {
    expect(() => {
      service.buildPrompt({
        purpose: 'question_generation',
        templates: [
          createTemplate({
            purpose: 'question_generation',
            templateText: 'analysis={{code_analysis_json}}',
            variablesJson: {},
          }),
        ],
        variables: {
          code_analysis_json: '{}',
        },
      });
    }).toThrow(
      new PromptBuilderError(
        `${PROMPT_TEMPLATE_VARIABLE_UNDECLARED}: purpose=question_generation variable=code_analysis_json`,
      ),
    );
  });

  it('throws when variablesJson declares an unsupported type label', () => {
    expect(() => {
      service.buildPrompt({
        purpose: 'code_summary',
        templates: [
          createTemplate({
            purpose: 'code_summary',
            templateText: 'repo={{repo_full_name}}',
            variablesJson: {
              repo_full_name: 'strng' as never,
            },
          }),
        ],
        variables: {
          repo_full_name: 'openai/code-ray',
        },
      });
    }).toThrow(
      new PromptBuilderError(
        `${PROMPT_TEMPLATE_VARIABLE_TYPE_INVALID}: unsupported declaration expected=strng`,
      ),
    );
  });

  it('renders object values as JSON strings for prompt inclusion', () => {
    const result = service.buildPrompt({
      purpose: 'question_generation',
      templates: [
        createTemplate({
          purpose: 'question_generation',
          templateText: 'analysis={{code_analysis_json}}',
          variablesJson: {
            code_analysis_json: 'json',
          },
        }),
      ],
      variables: {
        code_analysis_json: {
          summary: 'stable',
        },
      },
    });

    expect(result.prompt).toBe('analysis={"summary":"stable"}');
  });
});

function createTemplate(
  overrides: Partial<PromptTemplateRecord> & Pick<PromptTemplateRecord, 'purpose'>,
): PromptTemplateRecord {
  return {
    isActive: overrides.isActive ?? true,
    purpose: overrides.purpose,
    templateKey: overrides.templateKey ?? `${overrides.purpose}-v1`,
    templateName: overrides.templateName ?? `${overrides.purpose} template`,
    templateText: overrides.templateText ?? 'template',
    variablesJson: overrides.variablesJson ?? {},
    version: overrides.version ?? 1,
  };
}
