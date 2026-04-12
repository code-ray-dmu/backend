import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { AnalysisRunsEntity } from './analysis-runs.entity';
import { ApplicantsEntity } from './applicants.entity';
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

  @OneToOne(() => AnalysisRunsEntity, (analysisRun) => analysisRun.codeAnalysis, {
    nullable: false,
  })
  @JoinColumn({ name: 'analysis_run_id' })
  analysisRun: AnalysisRunsEntity;

  @ManyToOne(() => ApplicantsEntity, (applicant) => applicant.codeAnalyses, { nullable: false })
  @JoinColumn({ name: 'applicant_id' })
  applicant: ApplicantsEntity;
}
