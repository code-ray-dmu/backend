import { GroupsEntity } from '@app/database';
import { GroupsSortField, GroupsSortOrder } from './get-groups-query.dto';

export interface GroupListItemDto {
  group_id: string;
  name: string;
  created_at: string;
}

export interface GroupDetailDto {
  group_id: string;
  name: string;
  description: string | null;
  tech_stacks: Record<string, unknown>;
  culture_fit_priority: string;
}

export interface GroupsListQuery {
  userId: string;
  page: number;
  size: number;
  sort: GroupsSortField;
  order: GroupsSortOrder;
}

export interface GroupsListResult {
  items: GroupsEntity[];
  total: number;
  page: number;
  size: number;
}

export const toGroupListItemDto = (group: GroupsEntity): GroupListItemDto => ({
  group_id: group.id,
  name: group.name,
  created_at: group.createdAt.toISOString(),
});

export const toGroupDetailDto = (group: GroupsEntity): GroupDetailDto => ({
  group_id: group.id,
  name: group.name,
  description: group.description ?? null,
  tech_stacks: group.techStacks,
  culture_fit_priority: group.cultureFitPriority,
});
