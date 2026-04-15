import { Injectable } from '@nestjs/common';
import {
  ApplicantNotFoundException,
  ForbiddenResourceAccessException,
  GroupNotFoundException,
} from '../../common/exceptions';
import { GroupsRepository } from '../groups/repositories/groups.repository';
import {
  ApplicantDetailDto,
  ApplicantOwnershipResult,
  ApplicantsPageResultDto,
  CreateApplicantDto,
  CreateApplicantResultDto,
  GetApplicantsQueryDto,
  toApplicantDetailDto,
  toApplicantsPageResultDto,
  toCreateApplicantResultDto,
} from './dto';
import { ApplicantsRepository } from './repositories/applicants.repository';

@Injectable()
export class ApplicantsService {
  constructor(
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly groupsRepository: GroupsRepository,
  ) {}

  async createApplicant(
    userId: string,
    input: CreateApplicantDto,
  ): Promise<CreateApplicantResultDto> {
    const group = await this.groupsRepository.findGroupById(input.groupId);

    if (!group) {
      throw new GroupNotFoundException();
    }

    if (group.userId !== userId) {
      throw new ForbiddenResourceAccessException();
    }

    const applicant = await this.applicantsRepository.createApplicant({
      groupId: input.groupId,
      name: input.name,
      email: input.email,
      githubUrl: input.githubUrl,
    });

    return toCreateApplicantResultDto(applicant);
  }

  async getApplicants(
    userId: string,
    query: GetApplicantsQueryDto,
  ): Promise<ApplicantsPageResultDto> {
    const applicants = await this.applicantsRepository.getApplicants({
      userId,
      groupId: query.groupId,
      page: query.page,
      size: query.size,
      sort: query.sort,
      order: query.order,
    });

    return toApplicantsPageResultDto(applicants);
  }

  async getApplicant(applicantId: string, userId: string): Promise<ApplicantDetailDto> {
    const applicant = await this.applicantsRepository.findApplicantById(applicantId);

    if (!applicant) {
      throw new ApplicantNotFoundException();
    }

    if (applicant.group.userId !== userId) {
      throw new ForbiddenResourceAccessException();
    }

    return toApplicantDetailDto(applicant);
  }

  async getApplicantOwnership(
    applicantId: string,
    userId: string,
  ): Promise<ApplicantOwnershipResult> {
    const ownership = await this.applicantsRepository.getApplicantOwnership(applicantId);

    if (!ownership) {
      throw new ApplicantNotFoundException();
    }

    if (ownership.groupUserId !== userId) {
      throw new ForbiddenResourceAccessException();
    }

    return ownership;
  }
}
