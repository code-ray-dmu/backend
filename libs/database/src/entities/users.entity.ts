import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { AnalysisRunsEntity } from './analysis-runs.entity';
import { GroupsEntity } from './groups.entity';
import { RefreshTokensEntity } from './refresh-tokens.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';

@Entity('users')
export class UsersEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name?: string;

  @OneToMany(() => GroupsEntity, (group) => group.user)
  groups: GroupsEntity[];

  @OneToMany(() => RefreshTokensEntity, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshTokensEntity[];

  @OneToMany(() => AnalysisRunsEntity, (analysisRun) => analysisRun.requestedByUser)
  requestedAnalysisRuns: AnalysisRunsEntity[];
}
