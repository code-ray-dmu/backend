import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApplicantsEntity } from '@app/database';
import {
  ApplicantOwnershipResult,
  ApplicantsListQuery,
  ApplicantsListResult,
  CreateApplicantRepositoryInput,
  toApplicantOwnershipResult,
} from '../dto';
import { FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';

@Injectable()
export class ApplicantsRepository {
  constructor(
    @InjectRepository(ApplicantsEntity)
    private readonly applicantsOrmRepository: Repository<ApplicantsEntity>,
  ) {}

  async createApplicant(input: CreateApplicantRepositoryInput): Promise<ApplicantsEntity> {
    const applicant = this.applicantsOrmRepository.create({
      groupId: input.groupId,
      name: input.name,
      email: input.email,
      githubUrl: input.githubUrl,
    });

    return this.applicantsOrmRepository.save(applicant);
  }

  async findApplicantById(applicantId: string): Promise<ApplicantsEntity | null> {
    return this.applicantsOrmRepository.findOne({
      where: {
        id: applicantId,
      },
      select: {
        id: true,
        groupId: true,
        name: true,
        email: true,
        githubUrl: true,
        group: {
          userId: true,
        },
      },
      relations: {
        group: true,
      },
    });
  }

  async findApplicantByIdAndUserId(
    applicantId: string,
    userId: string,
  ): Promise<ApplicantsEntity | null> {
    return this.applicantsOrmRepository.findOne({
      where: {
        id: applicantId,
        group: {
          userId,
        },
      },
    });
  }

  async getApplicants(query: ApplicantsListQuery): Promise<ApplicantsListResult> {
    const where: FindOptionsWhere<ApplicantsEntity> = {
      group: {
        userId: query.userId,
      },
    };

    if (query.groupId) {
      where.group = {
        userId: query.userId,
        id: query.groupId,
      };
    }

    const [items, total] = await this.applicantsOrmRepository.findAndCount({
      where,
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

  async getApplicantOwnership(
    applicantId: string,
  ): Promise<ApplicantOwnershipResult | null> {
    const applicant = await this.applicantsOrmRepository.findOne({
      where: {
        id: applicantId,
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

    if (!applicant) {
      return null;
    }

    return toApplicantOwnershipResult({
      applicantId: applicant.id,
      groupId: applicant.groupId,
      groupUserId: applicant.group.userId,
      githubUrl: applicant.githubUrl,
    });
  }

  private getOrderBy(
    sort: ApplicantsListQuery['sort'],
    order: ApplicantsListQuery['order'],
  ): FindOptionsOrder<ApplicantsEntity> {
    if (sort === 'name') {
      return {
        name: order,
        id: 'asc',
      };
    }

    return {
      createdAt: order,
      id: 'asc',
    };
  }
}
