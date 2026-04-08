import { AnalysisStage, LlmMessageRole } from '@app/core';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('llm_messages')
export class LlmMessagesEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'analysis_run_id', type: 'uuid' })
  analysisRunId: string;

  @Column({ enum: AnalysisStage, type: 'enum' })
  stage: AnalysisStage;

  @Column({ enum: LlmMessageRole, type: 'enum' })
  role: LlmMessageRole;

  @Column({ type: 'text' })
  content: string;
}
