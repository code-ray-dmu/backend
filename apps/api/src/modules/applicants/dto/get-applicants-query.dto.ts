import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export const APPLICANTS_SORT_FIELDS = ['createdAt', 'name'] as const;
export const APPLICANTS_SORT_ORDERS = ['asc', 'desc'] as const;

export type ApplicantsSortField = (typeof APPLICANTS_SORT_FIELDS)[number];
export type ApplicantsSortOrder = (typeof APPLICANTS_SORT_ORDERS)[number];

export class GetApplicantsQueryDto {
  @IsOptional()
  @IsUUID()
    groupId?: string;

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
  @IsIn(APPLICANTS_SORT_FIELDS)
    sort: ApplicantsSortField = 'createdAt';

  @IsOptional()
  @IsIn(APPLICANTS_SORT_ORDERS)
    order: ApplicantsSortOrder = 'desc';
}
