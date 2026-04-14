import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const GROUPS_SORT_FIELDS = ['createdAt', 'name'] as const;
export const GROUPS_SORT_ORDERS = ['asc', 'desc'] as const;

export type GroupsSortField = (typeof GROUPS_SORT_FIELDS)[number];
export type GroupsSortOrder = (typeof GROUPS_SORT_ORDERS)[number];

export class GetGroupsQueryDto {
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
  @IsIn(GROUPS_SORT_FIELDS)
    sort: GroupsSortField = 'createdAt';

  @IsOptional()
  @IsIn(GROUPS_SORT_ORDERS)
    order: GroupsSortOrder = 'desc';
}
