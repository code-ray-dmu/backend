import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import {
  GENERATED_QUESTIONS_SORT_FIELDS,
  GENERATED_QUESTIONS_SORT_ORDERS,
  GeneratedQuestionsSortField,
  GeneratedQuestionsSortOrder,
} from '../../generated-questions/dto';

export class GetApplicantQuestionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
    page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
    size: number = 20;

  @IsOptional()
  @IsIn(GENERATED_QUESTIONS_SORT_FIELDS)
    sort: GeneratedQuestionsSortField = 'priority';

  @IsOptional()
  @IsIn(GENERATED_QUESTIONS_SORT_ORDERS)
    order: GeneratedQuestionsSortOrder = 'asc';
}
