import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('prompt_templates')
export class PromptTemplatesEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn()
    id: number;

  @Column({ name: 'template_key' })
    templateKey: string;

  @Column({ name: 'template_name' })
    templateName: string;

  @Column()
    purpose: string;

  @Column({ name: 'template_text', type: 'text' })
    templateText: string;

  @Column({ name: 'variables_json', nullable: true, type: 'jsonb' })
    variablesJson?: Record<string, unknown>;

  @Column()
    version: number;

  @Column({ name: 'is_active', default: true })
    isActive: boolean;
}
