import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';
import type { LlmProviderAdapter } from './interfaces';
import type {
  GenerateQuestionsInput,
  GenerateQuestionsResult,
  SelectFilesInput,
  SelectFilesResult,
  SummarizeCodeInput,
  SummarizeCodeResult,
} from './llm.types';

export interface OpenAiProviderConfig {
  apiKey: string;
  maxRetries: number;
  model: string;
  timeoutMs: number;
}

@Injectable()
export class OpenAiProviderAdapter implements LlmProviderAdapter {
  private readonly client: OpenAI;

  constructor(private readonly config: OpenAiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries,
      timeout: config.timeoutMs,
    });
  }

  async generateQuestions(
    input: GenerateQuestionsInput,
  ): Promise<GenerateQuestionsResult> {
    return this.createTextResult({
      prompt: input.prompt,
      temperature: 0.3,
    });
  }

  async selectFiles(input: SelectFilesInput): Promise<SelectFilesResult> {
    return this.createTextResult({
      prompt: input.prompt,
      temperature: 0,
    });
  }

  async summarizeCode(
    input: SummarizeCodeInput,
  ): Promise<SummarizeCodeResult> {
    return this.createTextResult({
      prompt: input.prompt,
      responseFormat: {
        type: 'json_object',
      },
      temperature: 0.2,
    });
  }

  private async createTextResult(input: {
    prompt: string;
    responseFormat?: ChatCompletionCreateParamsNonStreaming['response_format'];
    temperature: number;
  }): Promise<{ content: string }> {
    try {
      const isTemperatureSupported = !this.config.model.includes('nano');

      const completion = await this.client.chat.completions.create({
        messages: this.buildMessages(input.prompt),
        model: this.config.model,
        response_format: input.responseFormat,
        ...(isTemperatureSupported && {
          temperature: input.temperature,
        }),
      });

      const content = completion.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('OpenAI response content is empty.');
      }

      return { content };
    } catch (error) {
      throw this.toLlmProviderError(error);
    }
  }

  private buildMessages(prompt: string): ChatCompletionMessageParam[] {
    return [
      {
        content:
          'You are an analysis assistant that must return only valid JSON.',
        role: 'system',
      },
      {
        content: prompt,
        role: 'user',
      },
    ];
  }

  private toLlmProviderError(error: unknown): Error {
    if (error instanceof OpenAI.APIConnectionError) {
      return new Error(`LLM_PROVIDER_CONNECTION_FAILED: ${error.message}`);
    }

    if (error instanceof OpenAI.RateLimitError) {
      return new Error(`LLM_PROVIDER_RATE_LIMITED: ${error.message}`);
    }

    if (error instanceof OpenAI.APIUserAbortError) {
      return new Error(`LLM_PROVIDER_ABORTED: ${error.message}`);
    }

    if (error instanceof OpenAI.APIError) {
      return new Error(
        `LLM_PROVIDER_REQUEST_FAILED: ${error.status ?? 'unknown'} ${error.message}`,
      );
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('LLM_PROVIDER_REQUEST_FAILED: Unknown OpenAI error');
  }
}
