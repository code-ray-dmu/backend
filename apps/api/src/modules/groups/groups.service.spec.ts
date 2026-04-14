import 'reflect-metadata';

import { GroupsEntity } from '@app/database';
import {
  ForbiddenResourceAccessException,
  GroupNotFoundException,
} from '../../common/exceptions';
import { CreateGroupDto, GetGroupsQueryDto } from './dto';
import { GroupsRepository } from './repositories/groups.repository';
import { GroupsService } from './groups.service';

describe('GroupsService', () => {
  let service: GroupsService;
  let repository: jest.Mocked<GroupsRepository>;

  const createGroupEntity = (overrides?: Partial<GroupsEntity>): GroupsEntity =>
    ({
      id: 'group-1',
      userId: 'user-1',
      name: 'backend-team',
      description: 'msa based team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
      createdAt: new Date('2026-04-08T15:00:00.000Z'),
      updatedAt: new Date('2026-04-08T15:00:00.000Z'),
      user: undefined,
      applicants: [],
      ...overrides,
    }) as unknown as GroupsEntity;

  beforeEach((): void => {
    repository = {
      createGroup: jest.fn(),
      findGroupById: jest.fn(),
      findGroupByIdAndUserId: jest.fn(),
      getGroups: jest.fn(),
    } as unknown as jest.Mocked<GroupsRepository>;

    service = new GroupsService(repository);
  });

  it('creates a group from the JWT user id and maps the result', async (): Promise<void> => {
    const input: CreateGroupDto = {
      name: 'backend-team',
      description: 'msa based team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
    };

    repository.createGroup.mockResolvedValue(createGroupEntity());

    await expect(service.createGroup('user-1', input)).resolves.toEqual({
      group_id: 'group-1',
      name: 'backend-team',
      created_at: '2026-04-08T15:00:00.000Z',
    });

    expect(repository.createGroup).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'backend-team',
      description: 'msa based team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
    });
  });

  it('returns paginated groups for the current user', async (): Promise<void> => {
    const query = new GetGroupsQueryDto();
    query.page = 1;
    query.size = 20;
    query.sort = 'createdAt';
    query.order = 'desc';

    repository.getGroups.mockResolvedValue({
      items: [
        createGroupEntity({ description: 'desc' }),
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    await expect(service.getGroups('user-1', query)).resolves.toEqual({
      items: [
        {
          group_id: 'group-1',
          name: 'backend-team',
          created_at: '2026-04-08T15:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    expect(repository.getGroups).toHaveBeenCalledWith({
      userId: 'user-1',
      page: 1,
      size: 20,
      sort: 'createdAt',
      order: 'desc',
    });
  });

  it('returns group detail when the current user owns the group', async (): Promise<void> => {
    repository.findGroupById.mockResolvedValue(createGroupEntity());

    await expect(service.getGroup('group-1', 'user-1')).resolves.toEqual({
      group_id: 'group-1',
      name: 'backend-team',
      description: 'msa based team',
      tech_stacks: { framework: 'NestJS' },
      culture_fit_priority: 'HIGH',
    });
  });

  it('throws GROUP_NOT_FOUND when the group does not exist', async (): Promise<void> => {
    repository.findGroupById.mockResolvedValue(null);

    await expect(service.getGroup('group-1', 'user-1')).rejects.toBeInstanceOf(
      GroupNotFoundException,
    );
  });

  it('throws FORBIDDEN_RESOURCE_ACCESS when another user owns the group', async (): Promise<void> => {
    repository.findGroupById.mockResolvedValue(createGroupEntity({ userId: 'user-2' }));

    await expect(service.getGroup('group-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenResourceAccessException,
    );
  });
});
