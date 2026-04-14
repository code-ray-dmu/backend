import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GroupsEntity } from '@app/database';
import { FindOptionsOrder, Repository } from 'typeorm';
import { CreateGroupInput, GroupsListQuery, GroupsListResult } from '../dto';

@Injectable()
export class GroupsRepository {
  constructor(
    @InjectRepository(GroupsEntity)
    private readonly groupsOrmRepository: Repository<GroupsEntity>,
  ) {}

  async createGroup(input: CreateGroupInput): Promise<GroupsEntity> {
    const group = this.groupsOrmRepository.create({
      userId: input.userId,
      name: input.name,
      description: input.description ?? null,
      techStacks: input.techStacks,
      cultureFitPriority: input.cultureFitPriority,
    });

    return this.groupsOrmRepository.save(group);
  }

  async findGroupById(groupId: string): Promise<GroupsEntity | null> {
    return this.groupsOrmRepository.findOne({
      where: {
        id: groupId,
      },
    });
  }

  async findGroupByIdAndUserId(
    groupId: string,
    userId: string,
  ): Promise<GroupsEntity | null> {
    return this.groupsOrmRepository.findOne({
      where: {
        id: groupId,
        userId,
      },
    });
  }

  async getGroups(query: GroupsListQuery): Promise<GroupsListResult> {
    const [items, total] = await this.groupsOrmRepository.findAndCount({
      where: {
        userId: query.userId,
      },
      order: this.getOrderBy(query.sort, query.order),
      skip: (query.page - 1) * query.size,
      take: query.size,
    });

    return {
      items,
      total,
      page: query.page,
      size: query.size,
    };
  }

  private getOrderBy(
    sort: GroupsListQuery['sort'],
    order: GroupsListQuery['order'],
  ): FindOptionsOrder<GroupsEntity> {
    if (sort === 'name') {
      return {
        name: order,
      };
    }

    return {
      createdAt: order,
    };
  }
}
