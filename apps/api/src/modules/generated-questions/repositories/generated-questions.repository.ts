import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GeneratedQuestionsEntity } from '@app/database';
import { Repository } from 'typeorm';
import {
  GeneratedQuestionsListResult,
  GetGeneratedQuestionsForApplicantQuery,
} from '../dto';

@Injectable()
export class GeneratedQuestionsRepository {
  constructor(
    @InjectRepository(GeneratedQuestionsEntity)
    private readonly generatedQuestionsOrmRepository: Repository<GeneratedQuestionsEntity>,
  ) {}

  async getQuestionsForApplicant(
    query: GetGeneratedQuestionsForApplicantQuery,
  ): Promise<GeneratedQuestionsListResult> {
    // `createdAt` sorting is anchored to the parent analysis run timestamp.
    const orderByField =
      query.sort === 'priority' ? 'generatedQuestion.priority' : 'analysisRun.createdAt';

    const queryBuilder = this.generatedQuestionsOrmRepository
      .createQueryBuilder('generatedQuestion')
      .leftJoin('generatedQuestion.analysisRun', 'analysisRun')
      .where('generatedQuestion.applicantId = :applicantId', {
        applicantId: query.applicantId,
      })
      .skip((query.page - 1) * query.size)
      .take(query.size)
      .orderBy(orderByField, query.order.toUpperCase() as 'ASC' | 'DESC')
      .addOrderBy('generatedQuestion.id', 'ASC');

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page: query.page,
      size: query.size,
    };
  }
}
