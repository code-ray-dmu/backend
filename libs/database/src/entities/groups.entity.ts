import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('groups')
export class GroupsEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ name: 'tech_stacks', type: 'jsonb' })
  techStacks: Record<string, unknown>;

  @Column({ name: 'culture_fit_priority' })
  cultureFitPriority: string;
}
