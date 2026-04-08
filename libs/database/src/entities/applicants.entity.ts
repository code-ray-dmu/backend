import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('applicants')
export class ApplicantsEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ name: 'github_url' })
  githubUrl: string;
}
