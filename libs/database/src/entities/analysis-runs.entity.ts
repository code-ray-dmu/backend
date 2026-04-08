import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('analysis_runs')
export class AnalysisRunsEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId: string;

  @Column({ name: 'requested_by_user_id', type: 'uuid' })
  requestedByUserId: string;

  @Column({ enum: AnalysisRunStatus, type: 'enum' })
  status: AnalysisRunStatus;

  @Column({ enum: AnalysisStage, name: 'current_stage', nullable: true, type: 'enum' })
  currentStage?: AnalysisStage;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'failure_reason', nullable: true })
  failureReason?: string;
}
