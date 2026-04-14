export const LLM_RESPONSE_PARSE_FAILED = 'LLM_RESPONSE_PARSE_FAILED';

export class LlmParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmParserError';
  }
}
