import 'reflect-metadata';

import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { JwtAuthGuard } from '../auth/guards';
import { CreateGroupDto, GetGroupsQueryDto } from './dto';
import { GroupsFacade } from './groups.facade';
import { GroupsController } from './groups.controller';

describe('GroupsController', () => {
  let controller: GroupsController;
  let facade: jest.Mocked<GroupsFacade>;

  beforeEach((): void => {
    facade = {
      createGroup: jest.fn(),
      getGroup: jest.fn(),
      getGroups: jest.fn(),
    } as unknown as jest.Mocked<GroupsFacade>;

    controller = new GroupsController(facade);
  });

  it('applies the groups auth and response contract decorators', (): void => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, GroupsController) as Array<new () => unknown>;
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      GroupsController,
    ) as Array<new () => unknown>;
    const filters = Reflect.getMetadata(
      EXCEPTION_FILTERS_METADATA,
      GroupsController,
    ) as Array<new () => unknown>;

    expect(guards).toContain(JwtAuthGuard);
    expect(interceptors).toContain(ApiResponseEnvelopeInterceptor);
    expect(filters).toContain(ApiExceptionFilter);
  });

  it('returns an enveloped body for POST /groups', async (): Promise<void> => {
    const body: CreateGroupDto = {
      name: 'backend-team',
      description: 'msa based team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
    };

    facade.createGroup.mockResolvedValue({
      group_id: 'group-1',
      name: 'backend-team',
      created_at: '2026-04-08T15:00:00.000Z',
    });

    await expect(controller.createGroup('user-1', body)).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        group_id: 'group-1',
        name: 'backend-team',
        created_at: '2026-04-08T15:00:00.000Z',
      },
      meta: undefined,
    });

    expect(facade.createGroup).toHaveBeenCalledWith('user-1', body);
  });

  it('returns an enveloped body for GET /groups with pagination meta', async (): Promise<void> => {
    const query = new GetGroupsQueryDto();
    query.page = 1;
    query.size = 20;
    query.sort = 'createdAt';
    query.order = 'desc';

    facade.getGroups.mockResolvedValue({
      items: [{ group_id: 'group-1', name: 'backend-team', created_at: '2026-04-08T15:00:00.000Z' }],
      total: 1,
      page: 1,
      size: 20,
    });

    await expect(controller.getGroups('user-1', query)).resolves.toEqual({
      __apiSuccessBody: true,
      data: [{ group_id: 'group-1', name: 'backend-team', created_at: '2026-04-08T15:00:00.000Z' }],
      meta: {
        page: 1,
        size: 20,
        total: 1,
      },
    });
  });

  it('returns an enveloped body for GET /groups/:groupId', async (): Promise<void> => {
    facade.getGroup.mockResolvedValue({
      group_id: 'group-1',
      name: 'backend-team',
      description: 'msa based team',
      tech_stacks: { framework: 'NestJS' },
      culture_fit_priority: 'HIGH',
    });

    await expect(controller.getGroup('user-1', 'group-1')).resolves.toEqual({
      __apiSuccessBody: true,
      data: {
        group_id: 'group-1',
        name: 'backend-team',
        description: 'msa based team',
        tech_stacks: { framework: 'NestJS' },
        culture_fit_priority: 'HIGH',
      },
      meta: undefined,
    });
  });
});
