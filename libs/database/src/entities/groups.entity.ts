import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { ApplicantsEntity } from './applicants.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';
import { UsersEntity } from './users.entity';

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

  @ManyToOne(() => UsersEntity, (user) => user.groups, { nullable: false })
  @JoinColumn({ name: 'user_id' })
    user: UsersEntity;

  @OneToMany(() => ApplicantsEntity, (applicant) => applicant.group)
    applicants: ApplicantsEntity[];
}
