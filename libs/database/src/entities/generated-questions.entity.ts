import { GeneratedQuestionCategory } from '@app/core';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
