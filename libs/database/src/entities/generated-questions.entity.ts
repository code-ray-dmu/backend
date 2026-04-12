import { GeneratedQuestionCategory } from '@app/core';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { AnalysisRunsEntity } from './analysis-runs.entity';
import { ApplicantsEntity } from './applicants.entity';

@Entity('generated_questions')
export class GeneratedQuestionsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'analysis_run_id', type: 'uuid' })
  analysisRunId: string;

  @Column({ name: 'applicant_id', type: 'uuid' })
  applicantId: string;

  @Column({ enum: GeneratedQuestionCategory, type: 'enum' })
  category: GeneratedQuestionCategory;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  @Column({ nullable: true })
  intent?: string;

  @Column({ nullable: true })
  priority?: number;

  @ManyToOne(() => AnalysisRunsEntity, (analysisRun) => analysisRun.generatedQuestions, {
    nullable: false,
  })
  @JoinColumn({ name: 'analysis_run_id' })
  analysisRun: AnalysisRunsEntity;

  @ManyToOne(() => ApplicantsEntity, (applicant) => applicant.generatedQuestions, {
    nullable: false,
  })
  @JoinColumn({ name: 'applicant_id' })
  applicant: ApplicantsEntity;
}
