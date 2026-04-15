import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ApplicantDetailDto,
  ApplicantsListResult,
  ApplicantsPageResultDto,
  toApplicantDetailDto,
  toApplicantListItemDto,
  toApplicantOwnershipResult,
  toApplicantsPageResultDto,
} from './applicant-read.dto';
import { CreateApplicantDto, GITHUB_PROFILE_URL_REGEX } from './create-applicant.dto';
import { GetApplicantQuestionsQueryDto } from './get-applicant-questions-query.dto';
import { GetApplicantsQueryDto } from './get-applicants-query.dto';

describe('Applicants DTO validation', () => {
  it('accepts a valid create applicant body', async (): Promise<void> => {
    const dto = plainToInstance(CreateApplicantDto, {
      groupId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a repository url in githubUrl', async (): Promise<void> => {
    const dto = plainToInstance(CreateApplicantDto, {
      groupId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user/example-repo',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'githubUrl')).toBe(true);
  });

  it('rejects a githubUrl with trailing slash', async (): Promise<void> => {
    const dto = plainToInstance(CreateApplicantDto, {
      groupId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user/',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'githubUrl')).toBe(true);
  });

  it('rejects create applicant body when groupId is not a uuid', async (): Promise<void> => {
    const dto = plainToInstance(CreateApplicantDto, {
      groupId: 'not-a-uuid',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'groupId')).toBe(true);
  });

  it('rejects create applicant body when email is invalid', async (): Promise<void> => {
    const dto = plainToInstance(CreateApplicantDto, {
      groupId: '550e8400-e29b-41d4-a716-446655440010',
      name: 'candidate',
      email: 'invalid-email',
      githubUrl: 'https://github.com/example-user',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('documents the supported github profile url format', (): void => {
    expect(GITHUB_PROFILE_URL_REGEX.test('https://github.com/example-user')).toBe(true);
    expect(GITHUB_PROFILE_URL_REGEX.test('https://github.com/example-user/example-repo')).toBe(
      false,
    );
    expect(GITHUB_PROFILE_URL_REGEX.test('https://github.com/a-')).toBe(false);
    expect(GITHUB_PROFILE_URL_REGEX.test(`https://github.com/${'a'.repeat(39)}`)).toBe(true);
  });

  it('applies default pagination and sorting values for GET /applicants', (): void => {
    const dto = plainToInstance(GetApplicantsQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.size).toBe(20);
    expect(dto.sort).toBe('createdAt');
    expect(dto.order).toBe('desc');
  });

  it('rejects GET /applicants query when page is less than 1', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantsQueryDto, {
      page: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejects GET /applicants query when sort is unsupported', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantsQueryDto, {
      sort: 'updatedAt',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('applies default pagination and sorting values for GET /applicants/:applicantId/questions', (): void => {
    const dto = plainToInstance(GetApplicantQuestionsQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.size).toBe(20);
    expect(dto.sort).toBe('priority');
    expect(dto.order).toBe('asc');
  });

  it('rejects GET /applicants/:applicantId/questions query when sort is unsupported', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantQuestionsQueryDto, {
      sort: 'updatedAt',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('rejects GET /applicants/:applicantId/questions query when page is less than 1', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantQuestionsQueryDto, {
      page: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejects GET /applicants/:applicantId/questions query when size is less than 1', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantQuestionsQueryDto, {
      size: 0,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'size')).toBe(true);
  });

  it('rejects GET /applicants/:applicantId/questions query when order is unsupported', async (): Promise<void> => {
    const dto = plainToInstance(GetApplicantQuestionsQueryDto, {
      order: 'up',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'order')).toBe(true);
  });

  it('maps applicant entities to response dto shapes', (): void => {
    const createdAt = new Date('2026-04-08T15:00:00.000Z');
    const applicantEntity = {
      id: 'applicant-1',
      groupId: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      githubUrl: 'https://github.com/example-user',
      createdAt,
    } as ApplicantsListResult['items'][number];

    expect(toApplicantListItemDto(applicantEntity)).toEqual({
      applicant_id: 'applicant-1',
      group_id: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      github_url: 'https://github.com/example-user',
      created_at: '2026-04-08T15:00:00.000Z',
    });

    expect(toApplicantDetailDto(applicantEntity)).toEqual<ApplicantDetailDto>({
      applicant_id: 'applicant-1',
      group_id: 'group-1',
      name: 'candidate',
      email: 'candidate@example.com',
      github_url: 'https://github.com/example-user',
    });
  });

  it('maps paged repository results and ownership data to stable dto contracts', (): void => {
    const createdAt = new Date('2026-04-08T15:00:00.000Z');
    const result: ApplicantsListResult = {
      items: [
        {
          id: 'applicant-1',
          groupId: 'group-1',
          name: 'candidate',
          email: 'candidate@example.com',
          githubUrl: 'https://github.com/example-user',
          createdAt,
        } as ApplicantsListResult['items'][number],
      ],
      total: 1,
      page: 1,
      size: 20,
    };

    expect(toApplicantsPageResultDto(result)).toEqual<ApplicantsPageResultDto>({
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

    expect(
      toApplicantOwnershipResult({
        applicantId: 'applicant-1',
        groupId: 'group-1',
        groupUserId: 'user-1',
        githubUrl: 'https://github.com/example-user',
      }),
    ).toEqual({
      applicantId: 'applicant-1',
      groupId: 'group-1',
      groupUserId: 'user-1',
      githubUrl: 'https://github.com/example-user',
    });
  });
});
