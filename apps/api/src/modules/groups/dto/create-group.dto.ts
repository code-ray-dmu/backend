import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { GroupsEntity } from '@app/database';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
    name: string;

  @IsOptional()
  @IsString()
    description?: string | null;

  @IsObject()
    techStacks: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
    cultureFitPriority: string;
}

export interface CreateGroupInput {
  userId: string;
  name: string;
  description?: string | null;
  techStacks: Record<string, unknown>;
  cultureFitPriority: string;
}

export interface CreateGroupResultDto {
  group_id: string;
  name: string;
  created_at: string;
}

export const toCreateGroupResultDto = (group: GroupsEntity): CreateGroupResultDto => ({
  group_id: group.id,
  name: group.name,
  created_at: group.createdAt.toISOString(),
});
