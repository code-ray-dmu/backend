import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshTokensEntity } from '@app/database';
import { Repository } from 'typeorm';

export interface CreateRefreshTokenRepositoryInput {
  userId: string;
  tokenValue: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokensRepository {
  constructor(
    @InjectRepository(RefreshTokensEntity)
    private readonly refreshTokensRepository: Repository<RefreshTokensEntity>,
  ) {}

  async createRefreshToken(
    input: CreateRefreshTokenRepositoryInput,
  ): Promise<RefreshTokensEntity> {
    const refreshToken = this.refreshTokensRepository.create({
      userId: input.userId,
      tokenValue: input.tokenValue,
      expiresAt: input.expiresAt,
      isRevoked: false,
    });

    return this.refreshTokensRepository.save(refreshToken);
  }

  async rotateActiveRefreshToken(
    id: number,
    input: CreateRefreshTokenRepositoryInput,
  ): Promise<boolean> {
    return this.refreshTokensRepository.manager.transaction(async (manager) => {
      const revokeResult = await manager.update(
        RefreshTokensEntity,
        { id, isRevoked: false },
        { isRevoked: true },
      );

      if (revokeResult.affected !== 1) {
        return false;
      }

      const refreshToken = manager.create(RefreshTokensEntity, {
        userId: input.userId,
        tokenValue: input.tokenValue,
        expiresAt: input.expiresAt,
        isRevoked: false,
      });

      await manager.save(refreshToken);

      return true;
    });
  }

  async findByTokenValue(tokenValue: string): Promise<RefreshTokensEntity | null> {
    return this.refreshTokensRepository.findOne({
      where: { tokenValue },
    });
  }

  async revokeById(id: number): Promise<void> {
    await this.refreshTokensRepository.update({ id }, { isRevoked: true });
  }

  async revokeActiveById(id: number): Promise<boolean> {
    const result = await this.refreshTokensRepository.update(
      { id, isRevoked: false },
      { isRevoked: true },
    );

    return result.affected === 1;
  }

  async revokeByTokenValue(tokenValue: string): Promise<void> {
    await this.refreshTokensRepository.update({ tokenValue }, { isRevoked: true });
  }
}
