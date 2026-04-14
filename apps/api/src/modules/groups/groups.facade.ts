import { Injectable } from '@nestjs/common';
import {
  CreateGroupDto,
  CreateGroupResultDto,
  GetGroupsQueryDto,
  GroupDetailDto,
  GroupListItemDto,
} from './dto';
import { GroupsService } from './groups.service';

@Injectable()
export class GroupsFacade {
  constructor(private readonly groupsService: GroupsService) {}

  async createGroup(userId: string, input: CreateGroupDto): Promise<CreateGroupResultDto> {
    return this.groupsService.createGroup(userId, input);
  }

  async getGroup(groupId: string, userId: string): Promise<GroupDetailDto> {
    return this.groupsService.getGroup(groupId, userId);
  }

  async getGroups(
    userId: string,
    query: GetGroupsQueryDto,
  ): Promise<{
    items: GroupListItemDto[];
    total: number;
    page: number;
    size: number;
  }> {
    return this.groupsService.getGroups(userId, query);
  }
}
