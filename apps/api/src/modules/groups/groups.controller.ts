import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiSuccessBody } from '../../common/dto';
import { createApiSuccessBody } from '../../common/dto';
import { ApiExceptionFilter } from '../../common/filters';
import { ApiResponseEnvelopeInterceptor } from '../../common/interceptors';
import { JwtAuthGuard } from '../auth/guards';
import {
  CreateGroupDto,
  CreateGroupResultDto,
  GetGroupsQueryDto,
  GroupDetailDto,
  GroupListItemDto,
} from './dto';
import { CurrentUserId } from './decorators/current-user-id.decorator';
import { GroupsFacade } from './groups.facade';

@UseFilters(ApiExceptionFilter)
@UseGuards(JwtAuthGuard)
@UseInterceptors(ApiResponseEnvelopeInterceptor)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsFacade: GroupsFacade) {}

  @Post()
  async createGroup(
    @CurrentUserId() userId: string,
    @Body() body: CreateGroupDto,
  ): Promise<ApiSuccessBody<CreateGroupResultDto>> {
    const group = await this.groupsFacade.createGroup(userId, body);

    return createApiSuccessBody(group);
  }

  @Get()
  async getGroups(
    @CurrentUserId() userId: string,
    @Query() query: GetGroupsQueryDto,
  ): Promise<ApiSuccessBody<GroupListItemDto[]>> {
    const result = await this.groupsFacade.getGroups(userId, query);

    return createApiSuccessBody(result.items, {
      page: result.page,
      size: result.size,
      total: result.total,
    });
  }

  @Get(':groupId')
  async getGroup(
    @CurrentUserId() userId: string,
    @Param('groupId') groupId: string,
  ): Promise<ApiSuccessBody<GroupDetailDto>> {
    const group = await this.groupsFacade.getGroup(groupId, userId);

    return createApiSuccessBody(group);
  }
}
