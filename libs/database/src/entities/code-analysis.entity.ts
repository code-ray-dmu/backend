import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('code_analysis')
export class CodeAnalysisEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'analysis_run_id', type: 'uuid' })
  analysisRunId: string;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @Column({ name: 'raw_analysis_report', type: 'text' })
  rawAnalysisReport: string;
}
