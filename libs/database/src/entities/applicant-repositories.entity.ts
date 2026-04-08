import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('applicant_repositories')
export class ApplicantRepositoriesEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @Column({ name: 'repo_name' })
  repoName: string;

  @Column({ name: 'repo_full_name' })
  repoFullName: string;

  @Column({ name: 'repo_url' })
  repoUrl: string;

  @Column({ name: 'default_branch', nullable: true })
  defaultBranch?: string;
}
