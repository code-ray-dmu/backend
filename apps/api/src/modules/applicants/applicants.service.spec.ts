import 'reflect-metadata';

import { ApplicantsEntity, GroupsEntity } from '@app/database';
import {
  ApplicantNotFoundException,
  ForbiddenResourceAccessException,
  GroupNotFoundException,
} from '../../common/exceptions';
import { CreateApplicantDto, GetApplicantsQueryDto } from './dto';
import { ApplicantsRepository } from './repositories/applicants.repository';
import { ApplicantsService } from './applicants.service';
import { GroupsRepository } from '../groups/repositories/groups.repository';

describe('ApplicantsService', () => {
  let service: ApplicantsService;
  let applicantsRepository: jest.Mocked<ApplicantsRepository>;
  let groupsRepository: jest.Mocked<GroupsRepository>;

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
      applicants: [],
      user: undefined,
      ...overrides,
    }) as unknown as GroupsEntity;

  const createApplicantEntity = (overrides?: Partial<ApplicantsEntity>): ApplicantsEntity =>
    ({
      id: 'applicant-1',
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
      createdAt: new Date('2026-04-08T15:00:00.000Z'),
      updatedAt: new Date('2026-04-08T15:00:00.000Z'),
      group: createGroupEntity(),
      repositories: [],
      analysisRuns: [],
      generatedQuestions: [],
      codeAnalyses: [],
      ...overrides,
    }) as unknown as ApplicantsEntity;

  beforeEach((): void => {
    applicantsRepository = {
      createApplicant: jest.fn(),
      findApplicantById: jest.fn(),
      findApplicantByIdAndUserId: jest.fn(),
      getApplicants: jest.fn(),
      getApplicantOwnership: jest.fn(),
    } as unknown as jest.Mocked<ApplicantsRepository>;

    groupsRepository = {
      createGroup: jest.fn(),
      findGroupById: jest.fn(),
      findGroupByIdAndUserId: jest.fn(),
      getGroups: jest.fn(),
    } as unknown as jest.Mocked<GroupsRepository>;

    service = new ApplicantsService(applicantsRepository, groupsRepository);
  });

  it('creates an applicant after verifying group ownership', async (): Promise<void> => {
    const input: CreateApplicantDto = {
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    };

    groupsRepository.findGroupById.mockResolvedValue(createGroupEntity());
    applicantsRepository.createApplicant.mockResolvedValue(createApplicantEntity());

    await expect(service.createApplicant('user-1', input)).resolves.toEqual({
      applicant_id: 'applicant-1',
    });

    expect(applicantsRepository.createApplicant).toHaveBeenCalledWith({
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    });
  });

  it('throws GROUP_NOT_FOUND when create target group does not exist', async (): Promise<void> => {
    groupsRepository.findGroupById.mockResolvedValue(null);

    await expect(
      service.createApplicant('user-1', {
        groupId: 'group-1',
        name: 'candidate',
        email: 'candidate@example.com',
        githubUrl: 'https://github.com/example-user',
      }),
    ).rejects.toBeInstanceOf(GroupNotFoundException);
  });

  it('throws FORBIDDEN_RESOURCE_ACCESS when another user owns the group', async (): Promise<void> => {
    groupsRepository.findGroupById.mockResolvedValue(createGroupEntity({ userId: 'user-2' }));

    await expect(
      service.createApplicant('user-1', {
        groupId: 'group-1',
        name: 'candidate',
        email: 'candidate@example.com',
        githubUrl: 'https://github.com/example-user',
      }),
    ).rejects.toBeInstanceOf(ForbiddenResourceAccessException);
  });

  it('returns paginated applicants for the current user', async (): Promise<void> => {
    const query = new GetApplicantsQueryDto();
    query.page = 1;
    query.size = 20;
    query.groupId = 'group-1';
    query.sort = 'name';
    query.order = 'asc';

    applicantsRepository.getApplicants.mockResolvedValue({
      items: [createApplicantEntity()],
      total: 1,
      page: 1,
      size: 20,
    });

    await expect(service.getApplicants('user-1', query)).resolves.toEqual({
      items: [
        {
          applicant_id: 'applicant-1',
          group_id: 'group-1',
          name: 'candidate',
          email: 'candidate@example.com',
          github_url: 'https://github.com/example-user',
          created_at: '2026-04-08T15:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      size: 20,
    });

    expect(applicantsRepository.getApplicants).toHaveBeenCalledWith({
      userId: 'user-1',
      groupId: 'group-1',
      page: 1,
      size: 20,
      sort: 'name',
      order: 'asc',
    });
  });

  it('returns applicant detail for the current owner', async (): Promise<void> => {
    applicantsRepository.findApplicantById.mockResolvedValue(createApplicantEntity());

    await expect(service.getApplicant('applicant-1', 'user-1')).resolves.toEqual({
      applicant_id: 'applicant-1',
      group_id: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      github_url: 'https://github.com/example-user',
    });
  });

  it('throws APPLICANT_NOT_FOUND when applicant detail target does not exist', async (): Promise<void> => {
    applicantsRepository.findApplicantById.mockResolvedValue(null);

    await expect(service.getApplicant('applicant-1', 'user-1')).rejects.toBeInstanceOf(
      ApplicantNotFoundException,
    );
  });

  it('throws FORBIDDEN_RESOURCE_ACCESS when another user owns the applicant detail target', async (): Promise<void> => {
    applicantsRepository.findApplicantById.mockResolvedValue(
      createApplicantEntity({
        group: createGroupEntity({ userId: 'user-2' }),
      }),
    );

    await expect(service.getApplicant('applicant-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenResourceAccessException,
    );
  });

  it('returns applicant ownership data for the current owner', async (): Promise<void> => {
    applicantsRepository.getApplicantOwnership.mockResolvedValue({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });

    await expect(service.getApplicantOwnership('applicant-1', 'user-1')).resolves.toEqual({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
  });
});
