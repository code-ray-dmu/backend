import { Injectable } from '@nestjs/common';
import {
  ForbiddenResourceAccessException,
  GroupNotFoundException,
} from '../../common/exceptions';
import {
  CreateGroupDto,
  CreateGroupResultDto,
  GetGroupsQueryDto,
  GroupDetailDto,
  GroupListItemDto,
  GroupsListResult,
  toCreateGroupResultDto,
  toGroupDetailDto,
  toGroupListItemDto,
} from './dto';
import { GroupsRepository } from './repositories/groups.repository';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  async createGroup(userId: string, input: CreateGroupDto): Promise<CreateGroupResultDto> {
    const group = await this.groupsRepository.createGroup({
      userId,
      name: input.name,
      description: input.description,
      techStacks: input.techStacks,
      cultureFitPriority: input.cultureFitPriority,
    });

    return toCreateGroupResultDto(group);
  }

  async getGroup(groupId: string, userId: string): Promise<GroupDetailDto> {
    const group = await this.groupsRepository.findGroupById(groupId);

    if (!group) {
      throw new GroupNotFoundException();
    }

    if (group.userId !== userId) {
      throw new ForbiddenResourceAccessException();
    }

    return toGroupDetailDto(group);
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
    const result: GroupsListResult = await this.groupsRepository.getGroups({
      userId,
      page: query.page,
      size: query.size,
      sort: query.sort,
      order: query.order,
    });

    return {
      items: result.items.map(toGroupListItemDto),
      total: result.total,
      page: result.page,
      size: result.size,
    };
  }
}
