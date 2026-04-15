import { ApplicantsEntity } from '@app/database';
import { ApplicantsSortField, ApplicantsSortOrder } from './get-applicants-query.dto';

export interface ApplicantListItemDto {
  applicant_id: string;
  group_id: string;
  name: string;
  email: string;
  github_url: string;
  created_at: string;
}

export interface ApplicantDetailDto {
  applicant_id: string;
  group_id: string;
  name: string;
  email: string;
  github_url: string;
}

export interface ApplicantsPageResultDto {
  items: ApplicantListItemDto[];
  total: number;
  page: number;
  size: number;
}

export interface ApplicantsListQuery {
  userId: string;
  groupId?: string;
  page: number;
  size: number;
  sort: ApplicantsSortField;
  order: ApplicantsSortOrder;
}

export interface ApplicantsListResult {
  items: ApplicantsEntity[];
  total: number;
  page: number;
  size: number;
}

export interface ApplicantOwnershipResult {
  applicantId: string;
  groupId: string;
  groupUserId: string;
  githubUrl: string;
}

export const toApplicantListItemDto = (applicant: ApplicantsEntity): ApplicantListItemDto => ({
  applicant_id: applicant.id,
  group_id: applicant.groupId,
  name: applicant.name,
  email: applicant.email,
  github_url: applicant.githubUrl,
  created_at: applicant.createdAt.toISOString(),
});

export const toApplicantDetailDto = (applicant: ApplicantsEntity): ApplicantDetailDto => ({
  applicant_id: applicant.id,
  group_id: applicant.groupId,
  name: applicant.name,
  email: applicant.email,
  github_url: applicant.githubUrl,
});

export const toApplicantsPageResultDto = (
  result: ApplicantsListResult,
): ApplicantsPageResultDto => ({
  items: result.items.map(toApplicantListItemDto),
  total: result.total,
  page: result.page,
  size: result.size,
});

export const toApplicantOwnershipResult = (input: {
  applicantId: string;
  groupId: string;
  groupUserId: string;
  githubUrl: string;
}): ApplicantOwnershipResult => ({
  applicantId: input.applicantId,
  groupId: input.groupId,
  groupUserId: input.groupUserId,
  githubUrl: input.githubUrl,
});
