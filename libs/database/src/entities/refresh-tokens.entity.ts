import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { UsersEntity } from './users.entity';

@Entity('refresh_tokens')
export class RefreshTokensEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'token_value' })
  tokenValue: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @ManyToOne(() => UsersEntity, (user) => user.refreshTokens, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UsersEntity;
}
