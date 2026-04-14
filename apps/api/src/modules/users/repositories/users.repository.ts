import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from '@app/database';
import { QueryFailedError, Repository } from 'typeorm';

export interface CreateUserRepositoryInput {
  email: string;
  passwordHash: string;
  name?: string;
}

export type CreateUserRepositoryResult =
  | { isCreated: true; user: UsersEntity }
  | { isCreated: false; reason: 'EMAIL_CONFLICT' };

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
  ) {}

  async createUser(
    input: CreateUserRepositoryInput,
  ): Promise<CreateUserRepositoryResult> {
    const user = this.usersRepository.create(input);

    try {
      const savedUser = await this.usersRepository.save(user);

      return { isCreated: true, user: savedUser };
    } catch (error) {
      if (isEmailUniqueViolation(error)) {
        return { isCreated: false, reason: 'EMAIL_CONFLICT' };
      }

      throw error;
    }
  }

  async findByEmail(email: string): Promise<UsersEntity | null> {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async findById(id: string): Promise<UsersEntity | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.usersRepository.exists({
      where: { email },
    });
  }
}

function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string; constraint?: string };

  return (
    driverError.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    driverError.constraint === 'IDX_users_email_unique'
  );
}
