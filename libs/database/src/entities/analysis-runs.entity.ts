import { AnalysisRunStatus, AnalysisStage } from '@app/core';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ApplicantsEntity } from './applicants.entity';
import { ApplicantRepositoriesEntity } from './applicant-repositories.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';
import { CodeAnalysisEntity } from './code-analysis.entity';
import { GeneratedQuestionsEntity } from './generated-questions.entity';
import { LlmMessagesEntity } from './llm-messages.entity';
import { UsersEntity } from './users.entity';

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

  @ManyToOne(() => ApplicantsEntity, (applicant) => applicant.analysisRuns, { nullable: false })
  @JoinColumn({ name: 'applicant_id' })
  applicant: ApplicantsEntity;

  @ManyToOne(() => ApplicantRepositoriesEntity, (repository) => repository.analysisRuns, {
    nullable: false,
  })
  @JoinColumn({ name: 'repository_id' })
  repository: ApplicantRepositoriesEntity;

  @ManyToOne(() => UsersEntity, (user) => user.requestedAnalysisRuns, { nullable: false })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedByUser: UsersEntity;

  @OneToMany(() => LlmMessagesEntity, (llmMessage) => llmMessage.analysisRun)
  llmMessages: LlmMessagesEntity[];

  @OneToOne(() => CodeAnalysisEntity, (codeAnalysis) => codeAnalysis.analysisRun)
  codeAnalysis?: CodeAnalysisEntity;

  @OneToMany(
    () => GeneratedQuestionsEntity,
    (generatedQuestion) => generatedQuestion.analysisRun,
  )
  generatedQuestions: GeneratedQuestionsEntity[];
}
