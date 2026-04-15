import 'reflect-metadata';

import { ApplicantsEntity } from '@app/database';
import { Repository } from 'typeorm';
import { ApplicantsRepository } from './applicants.repository';

describe('ApplicantsRepository', () => {
  let repository: ApplicantsRepository;
  let ormRepository: jest.Mocked<Repository<ApplicantsEntity>>;

  beforeEach((): void => {
    ormRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as unknown as jest.Mocked<Repository<ApplicantsEntity>>;

    repository = new ApplicantsRepository(ormRepository);
  });

  it('creates and saves an applicant entity', async (): Promise<void> => {
    const applicant = { id: 'applicant-1' } as ApplicantsEntity;

    ormRepository.create.mockReturnValue(applicant);
    ormRepository.save.mockResolvedValue(applicant);

    await repository.createApplicant({
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    });

    expect(ormRepository.create).toHaveBeenCalledWith({
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    });
    expect(ormRepository.save).toHaveBeenCalledWith(applicant);
  });

  it('filters applicant list queries by current user, optional group, pagination, and sort', async (): Promise<void> => {
    ormRepository.findAndCount.mockResolvedValue([[], 0]);

    await repository.getApplicants({
      userId: 'user-1',
      groupId: 'group-1',
      page: 2,
      size: 20,
      sort: 'name',
      order: 'asc',
    });

    expect(ormRepository.findAndCount).toHaveBeenCalledWith({
      where: {
        group: {
          userId: 'user-1',
          id: 'group-1',
        },
      },
      order: {
        name: 'asc',
        id: 'asc',
      },
      skip: 20,
      take: 20,
    });
  });

  it('filters detail queries by applicant id and current user id', async (): Promise<void> => {
    ormRepository.findOne.mockResolvedValue(null);

    await repository.findApplicantByIdAndUserId('applicant-1', 'user-1');

    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'applicant-1',
        group: {
          userId: 'user-1',
        },
      },
    });
  });

  it('loads applicant ownership data with group owner information', async (): Promise<void> => {
    ormRepository.findOne.mockResolvedValue({
      id: 'applicant-1',
      groupId: 'group-1',
      githubUrl: 'https://github.com/example-user',
      group: {
        userId: 'user-1',
      },
    } as ApplicantsEntity);

    await expect(repository.getApplicantOwnership('applicant-1')).resolves.toEqual({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });

    expect(ormRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'applicant-1',
      },
      select: {
        id: true,
        groupId: true,
        githubUrl: true,
        group: {
          userId: true,
        },
      },
      relations: {
        group: true,
      },
    });
  });
});
