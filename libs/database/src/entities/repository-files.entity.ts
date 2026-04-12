import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ApplicantRepositoriesEntity } from './applicant-repositories.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('repository_files')
export class RepositoryFilesEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId: string;

  @Column()
  path: string;

  @Column({ name: 'raw_analysis_report', nullable: true, type: 'text' })
  rawAnalysisReport?: string;

  @ManyToOne(() => ApplicantRepositoriesEntity, (repository) => repository.repositoryFiles, {
    nullable: false,
  })
  @JoinColumn({ name: 'repository_id' })
  repository: ApplicantRepositoriesEntity;
}
