import { GeneratedQuestionCategory } from '@app/core';
import {
  LLM_RESPONSE_PARSE_FAILED,
  LlmParserError,
} from './parser.errors';
import { LlmParserService } from './parser.service';

describe('LlmParserService', () => {
  let service: LlmParserService;

  beforeEach(() => {
    service = new LlmParserService();
  });

  describe('parseFileSelection', () => {
    it('parses file paths, removes invalid items, and applies the max limit', () => {
      const result = service.parseFileSelection({
        content: JSON.stringify([
          ' src/main.ts ',
          '',
          1,
          'src/main.ts',
          'src/app.module.ts',
          'src/users/users.service.ts',
        ]),
        maxAnalysisFiles: 2,
      });

      expect(result).toEqual(['src/main.ts', 'src/app.module.ts']);
    });

    it('throws when the payload is malformed JSON', () => {
      expect(() => {
        service.parseFileSelection({
          content: '[',
          maxAnalysisFiles: 3,
        });
      }).toThrow(LLM_RESPONSE_PARSE_FAILED);
    });

    it('throws when no valid file path remains after normalization', () => {
      expect(() => {
        service.parseFileSelection({
          content: JSON.stringify([null, '', '   ']),
          maxAnalysisFiles: 3,
        });
      }).toThrow(
        new LlmParserError(
          `${LLM_RESPONSE_PARSE_FAILED}: stage=file_selection detail=no valid file paths`,
        ),
      );
    });
  });

  describe('parseCodeSummary', () => {
    it('parses the summary object and filters invalid nested items', () => {
      const result = service.parseCodeSummary(
        JSON.stringify({
          architecture: {
            evidence: ['src/app.module.ts', '', null],
            pattern: ' 계층형 아키텍처 ',
          },
          collaborationSignals: [
            {
              evidence: ['디렉토리 구조 일관성'],
              signal: '구조를 일관되게 유지한다',
            },
            {
              evidence: [],
              signal: 'drop',
            },
          ],
          recommendedQuestionAreas: {
            cultureFit: ['협업 기준', '', '문서화 습관'],
            skill: ['서비스 책임 분리'],
          },
          risks: [
            {
              evidence: ['예외 매핑이 일부 제한적임'],
              point: '예외 처리 일관성이 약할 수 있다',
            },
            {
              evidence: [],
              point: 'drop',
            },
          ],
          strengths: [
            {
              evidence: ['service와 controller 분리'],
              point: '책임 분리가 명확하다',
            },
          ],
          summary: ' 핵심 모듈 분리가 보이는 저장소다 ',
          technicalDecisions: [
            {
              assessment: 'NestJS DI 패턴을 일관되게 사용한다',
              evidence: ['UsersService 생성자 주입'],
              topic: '의존성 주입',
            },
            {
              assessment: '',
              evidence: ['drop'],
              topic: 'invalid',
            },
          ],
        }),
      );

      expect(result.summary).toBe('핵심 모듈 분리가 보이는 저장소다');
      expect(result.architecture).toEqual({
        evidence: ['src/app.module.ts'],
        pattern: '계층형 아키텍처',
      });
      expect(result.technicalDecisions).toEqual([
        {
          assessment: 'NestJS DI 패턴을 일관되게 사용한다',
          evidence: ['UsersService 생성자 주입'],
          topic: '의존성 주입',
        },
      ]);
      expect(result.risks).toHaveLength(1);
      expect(result.collaborationSignals).toHaveLength(1);
      expect(result.recommendedQuestionAreas).toEqual({
        cultureFit: ['협업 기준', '문서화 습관'],
        skill: ['서비스 책임 분리'],
      });
    });

    it('throws when required fields are missing or blank', () => {
      expect(() => {
        service.parseCodeSummary(
          JSON.stringify({
            architecture: {
              evidence: ['src/app.module.ts'],
              pattern: '',
            },
            collaborationSignals: [],
            recommendedQuestionAreas: {
              cultureFit: [],
              skill: [],
            },
            risks: [],
            strengths: [],
            summary: 'ok',
            technicalDecisions: [],
          }),
        );
      }).toThrow(
        new LlmParserError(
          `${LLM_RESPONSE_PARSE_FAILED}: stage=code_summary detail=code_summary.architecture.pattern must be a string`,
        ),
      );
    });

    it('throws when the payload root is not an object', () => {
      expect(() => {
        service.parseCodeSummary(JSON.stringify([]));
      }).toThrow(
        new LlmParserError(
          `${LLM_RESPONSE_PARSE_FAILED}: stage=code_summary detail=root must be an object`,
        ),
      );
    });
  });

  describe('parseGeneratedQuestions', () => {
    it('filters invalid questions, sorts by priority, and applies the max limit', () => {
      const result = service.parseGeneratedQuestions({
        content: JSON.stringify([
          {
            category: GeneratedQuestionCategory.CULTURE_FIT,
            intent: '협업 기준을 확인',
            priority: 2,
            questionText: '협업 시 구조화 기준을 설명해 주세요.',
          },
          {
            category: 'OTHER',
            intent: 'drop',
            priority: 1,
            questionText: 'invalid',
          },
          {
            category: GeneratedQuestionCategory.SKILL,
            intent: '설계 근거를 확인',
            priority: 0,
            questionText: '서비스 계층 분리 이유를 설명해 주세요.',
          },
          {
            category: GeneratedQuestionCategory.SKILL,
            intent: '',
            priority: 3,
            questionText: 'invalid',
          },
        ]),
        maxQuestionsPerAnalysisRun: 2,
      });

      expect(result).toEqual([
        {
          category: GeneratedQuestionCategory.SKILL,
          intent: '설계 근거를 확인',
          priority: 0,
          questionText: '서비스 계층 분리 이유를 설명해 주세요.',
        },
        {
          category: GeneratedQuestionCategory.CULTURE_FIT,
          intent: '협업 기준을 확인',
          priority: 2,
          questionText: '협업 시 구조화 기준을 설명해 주세요.',
        },
      ]);
    });

    it('defaults missing priority to zero', () => {
      const result = service.parseGeneratedQuestions({
        content: JSON.stringify([
          {
            category: GeneratedQuestionCategory.SKILL,
            intent: '설계 근거를 확인',
            questionText: '서비스 계층 분리 이유를 설명해 주세요.',
          },
          {
            category: GeneratedQuestionCategory.CULTURE_FIT,
            intent: '협업 기준을 확인',
            priority: 2,
            questionText: '협업 시 구조화 기준을 설명해 주세요.',
          },
        ]),
        maxQuestionsPerAnalysisRun: 2,
      });

      expect(result).toEqual([
        {
          category: GeneratedQuestionCategory.SKILL,
          intent: '설계 근거를 확인',
          priority: 0,
          questionText: '서비스 계층 분리 이유를 설명해 주세요.',
        },
        {
          category: GeneratedQuestionCategory.CULTURE_FIT,
          intent: '협업 기준을 확인',
          priority: 2,
          questionText: '협업 시 구조화 기준을 설명해 주세요.',
        },
      ]);
    });

    it('throws when the payload is malformed JSON', () => {
      expect(() => {
        service.parseGeneratedQuestions({
          content: '{',
          maxQuestionsPerAnalysisRun: 3,
        });
      }).toThrow(LLM_RESPONSE_PARSE_FAILED);
    });

    it('throws when every question item is invalid', () => {
      expect(() => {
        service.parseGeneratedQuestions({
          content: JSON.stringify([
            {
              category: 'OTHER',
              intent: '',
              priority: -1,
              questionText: '',
            },
          ]),
          maxQuestionsPerAnalysisRun: 3,
        });
      }).toThrow(
        new LlmParserError(
          `${LLM_RESPONSE_PARSE_FAILED}: stage=question_generation detail=no valid generated questions`,
        ),
      );
    });
  });
});
