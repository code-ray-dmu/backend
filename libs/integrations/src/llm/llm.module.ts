import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmClient } from './llm.client';
import { LlmService } from './llm.service';
import { LLM_PROVIDER_ADAPTER } from './llm.tokens';
import {
  OpenAiProviderAdapter,
  type OpenAiProviderConfig,
} from './openai-provider-adapter';
import { LlmParserService } from './parsers';
import { PromptBuilderService } from './prompt-builder';

@Module({
  providers: [
    {
      inject: [ConfigService],
      provide: LLM_PROVIDER_ADAPTER,
      useFactory: (configService: ConfigService): OpenAiProviderAdapter => {
        const apiKey = configService.get<string>('llm.apiKey');
        const model = configService.get<string>('llm.model');
        const maxRetries = configService.get<number>('llm.maxRetries');
        const timeoutMs = configService.get<number>('llm.timeoutMs');

        if (!apiKey) {
          throw new Error('LLM_API_KEY is required to initialize LLM provider.');
        }

        if (!model) {
          throw new Error('LLM_MODEL is required to initialize LLM provider.');
        }

        if (typeof maxRetries !== 'number' || Number.isNaN(maxRetries)) {
          throw new Error(
            'LLM_MAX_RETRIES is required to initialize LLM provider.',
          );
        }

        if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) {
          throw new Error(
            'LLM_TIMEOUT_MS is required to initialize LLM provider.',
          );
        }

        const config: OpenAiProviderConfig = {
          apiKey,
          maxRetries,
          model,
          timeoutMs,
        };

        return new OpenAiProviderAdapter(config);
      },
    },
    LlmClient,
    LlmParserService,
    LlmService,
    PromptBuilderService,
  ],
  exports: [LlmClient, LlmParserService, LlmService, PromptBuilderService],
})
export class LlmModule {}
