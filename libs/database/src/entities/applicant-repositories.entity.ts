import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { AnalysisRunsEntity } from './analysis-runs.entity';
import { ApplicantsEntity } from './applicants.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';
import { RepositoryFilesEntity } from './repository-files.entity';

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

  @ManyToOne(() => ApplicantsEntity, (applicant) => applicant.repositories, { nullable: false })
  @JoinColumn({ name: 'applicant_id' })
    applicant: ApplicantsEntity;

  @OneToMany(() => RepositoryFilesEntity, (repositoryFile) => repositoryFile.repository)
    repositoryFiles: RepositoryFilesEntity[];

  @OneToMany(() => AnalysisRunsEntity, (analysisRun) => analysisRun.repository)
    analysisRuns: AnalysisRunsEntity[];
}
