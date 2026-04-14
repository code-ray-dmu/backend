import { Injectable } from '@nestjs/common';
import { UsersEntity } from '@app/database';
import {
  CreateUserRepositoryInput,
  CreateUserRepositoryResult,
  UsersRepository,
} from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(
    input: CreateUserRepositoryInput,
  ): Promise<CreateUserRepositoryResult> {
    return this.usersRepository.createUser(input);
  }

  async findByEmail(email: string): Promise<UsersEntity | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<UsersEntity | null> {
    return this.usersRepository.findById(id);
  }

  async existsByEmail(email: string): Promise<boolean> {
    return this.usersRepository.existsByEmail(email);
  }
}
