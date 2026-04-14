import { Injectable, NotImplementedException } from '@nestjs/common';
import { GitHubService } from '@app/integrations';
import { ApplicantGithubRepositoryDto } from './dto';

@Injectable()
export class ApplicantGithubReposService {
  constructor(private readonly gitHubService: GitHubService) {}

  async getGithubReposForApplicant(
    _githubUrl: string,
  ): Promise<ApplicantGithubRepositoryDto[]> {
    throw new NotImplementedException('Applicant GitHub repo lookup is not implemented yet.');
  }
}
