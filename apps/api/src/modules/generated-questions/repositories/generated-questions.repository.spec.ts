import 'reflect-metadata';

import { GeneratedQuestionsEntity } from '@app/database';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { GeneratedQuestionsRepository } from './generated-questions.repository';

describe('GeneratedQuestionsRepository', () => {
  let repository: GeneratedQuestionsRepository;
  let ormRepository: jest.Mocked<Repository<GeneratedQuestionsEntity>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<GeneratedQuestionsEntity>>;

  beforeEach((): void => {
    queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<GeneratedQuestionsEntity>>;

    ormRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as jest.Mocked<Repository<GeneratedQuestionsEntity>>;

    repository = new GeneratedQuestionsRepository(ormRepository);
  });

  it('queries applicant questions with priority sorting and pagination', async (): Promise<void> => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await repository.getQuestionsForApplicant({
      applicantId: 'applicant-1',
      page: 2,
      size: 10,
      sort: 'priority',
      order: 'asc',
    });

    expect(ormRepository.createQueryBuilder).toHaveBeenCalledWith('generatedQuestion');
    expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
      'generatedQuestion.analysisRun',
      'analysisRun',
    );
    expect(queryBuilder.where).toHaveBeenCalledWith(
      'generatedQuestion.applicantId = :applicantId',
      {
        applicantId: 'applicant-1',
      },
    );
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('generatedQuestion.priority', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('generatedQuestion.id', 'ASC');
  });

  it('uses analysis run createdAt sorting when requested', async (): Promise<void> => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    await repository.getQuestionsForApplicant({
      applicantId: 'applicant-1',
      page: 1,
      size: 20,
      sort: 'createdAt',
      order: 'desc',
    });

    expect(queryBuilder.orderBy).toHaveBeenCalledWith('analysisRun.createdAt', 'DESC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('generatedQuestion.id', 'ASC');
  });
});
