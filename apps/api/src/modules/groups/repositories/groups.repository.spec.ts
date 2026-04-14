import 'reflect-metadata';

import { GroupsEntity } from '@app/database';
import { Repository } from 'typeorm';
import { GroupsRepository } from './groups.repository';

describe('GroupsRepository', () => {
  let repository: GroupsRepository;
  let ormRepository: jest.Mocked<Repository<GroupsEntity>>;

  beforeEach((): void => {
    ormRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<GroupsEntity>>;

    repository = new GroupsRepository(ormRepository);
  });

  it('filters group list queries by current user id and pagination options', async (): Promise<void> => {
    ormRepository.findAndCount.mockResolvedValue([[], 0]);

    await repository.getGroups({
      userId: 'user-1',
      page: 2,
      size: 20,
      sort: 'createdAt',
      order: 'desc',
    });

    expect(ormRepository.findAndCount).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
      },
      order: {
        createdAt: 'desc',
      },
      skip: 20,
      take: 20,
    });
  });

  it('filters detail queries by group id and current user id', async (): Promise<void> => {
    ormRepository.findOne.mockResolvedValue(null);

    await repository.findGroupByIdAndUserId('group-1', 'user-1');

    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'group-1',
        userId: 'user-1',
      },
    });
  });
});
