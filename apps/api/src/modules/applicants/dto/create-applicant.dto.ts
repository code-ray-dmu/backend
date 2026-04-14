import { ApplicantsEntity } from '@app/database';
import { IsEmail, IsNotEmpty, IsString, Matches, IsUUID } from 'class-validator';

export const GITHUB_PROFILE_URL_REGEX =
  /^https:\/\/github\.com\/[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;

export class CreateApplicantDto {
  @IsUUID()
    groupId: string;

  @IsString()
  @IsNotEmpty()
    name: string;

  @IsEmail()
    email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(GITHUB_PROFILE_URL_REGEX, {
    message: 'githubUrl must be a valid GitHub profile URL',
  })
    githubUrl: string;
}

export interface CreateApplicantInput {
  groupId: string;
  name: string;
  email: string;
  githubUrl: string;
}

export interface CreateApplicantRepositoryInput extends CreateApplicantInput {}

export interface CreateApplicantResultDto {
  applicant_id: string;
}

export const toCreateApplicantResultDto = (
  applicant: ApplicantsEntity,
): CreateApplicantResultDto => ({
  applicant_id: applicant.id,
});
