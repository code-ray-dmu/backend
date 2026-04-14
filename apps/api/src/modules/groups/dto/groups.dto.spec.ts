import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGroupDto } from './create-group.dto';
import { GetGroupsQueryDto } from './get-groups-query.dto';

describe('Groups DTO validation', () => {
  it('accepts a valid create group body', async (): Promise<void> => {
    const dto = plainToInstance(CreateGroupDto, {
      name: 'backend-team',
      description: 'msa based team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects create group body when name is missing', async (): Promise<void> => {
    const dto = plainToInstance(CreateGroupDto, {
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: 'HIGH',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects create group body when techStacks is not an object', async (): Promise<void> => {
    const dto = plainToInstance(CreateGroupDto, {
      name: 'backend-team',
      techStacks: 'NestJS',
      cultureFitPriority: 'HIGH',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'techStacks')).toBe(true);
  });

  it('rejects create group body when cultureFitPriority is empty', async (): Promise<void> => {
    const dto = plainToInstance(CreateGroupDto, {
      name: 'backend-team',
      techStacks: { framework: 'NestJS' },
      cultureFitPriority: '',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'cultureFitPriority')).toBe(true);
  });

  it('applies default pagination and sorting values for GET /groups', (): void => {
    const dto = plainToInstance(GetGroupsQueryDto, {});

    expect(dto.page).toBe(1);
    expect(dto.size).toBe(20);
    expect(dto.sort).toBe('createdAt');
    expect(dto.order).toBe('desc');
  });
});
