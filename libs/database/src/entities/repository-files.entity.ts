import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
