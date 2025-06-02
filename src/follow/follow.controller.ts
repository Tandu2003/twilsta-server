import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { FollowService } from './follow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserResponse } from '../auth/interfaces/auth.interface';
import {
  PaginationDto,
  FollowParamsDto,
  UserParamsDto,
  FollowRequestParamsDto,
} from './dto/follow.dto';
import {
  FollowStatusResponse,
  FollowListResponse,
  FollowRequestResponse,
} from './interfaces/follow.interface';

@ApiTags('Follow System')
@ApiExtraModels(
  PaginationDto,
  FollowParamsDto,
  UserParamsDto,
  FollowRequestParamsDto,
)
@Controller('follow')
@UseGuards(JwtAuthGuard)
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @Post(':targetUserId')
  @ApiOperation({ summary: 'Gửi yêu cầu theo dõi hoặc theo dõi trực tiếp' })
  @ApiResponse({
    status: 201,
    description: 'Follow request sent or user followed',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot follow yourself or already following',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async followUser(
    @CurrentUser() currentUser: UserResponse,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.followService.followUser(currentUser.id, targetUserId);
  }

  @Delete(':targetUserId')
  @ApiOperation({ summary: 'Hủy theo dõi người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Successfully unfollowed or cancelled request',
  })
  @ApiResponse({ status: 400, description: 'Cannot unfollow yourself' })
  @ApiResponse({ status: 404, description: 'Not following this user' })
  @ApiBearerAuth()
  async unfollowUser(
    @CurrentUser() currentUser: UserResponse,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.followService.unfollowUser(currentUser.id, targetUserId);
  }

  @Get('status/:userId')
  @ApiOperation({ summary: 'Kiểm tra trạng thái theo dõi với người dùng khác' })
  @ApiResponse({
    status: 200,
    description: 'Follow status retrieved',
    type: Object,
  })
  @ApiBearerAuth()
  async getFollowStatus(
    @CurrentUser() currentUser: UserResponse,
    @Param('userId') userId: string,
  ): Promise<FollowStatusResponse> {
    return this.followService.getFollowStatus(currentUser.id, userId);
  }

  @Get('followers/:userId')
  @ApiOperation({ summary: 'Lấy danh sách người theo dõi' })
  @ApiResponse({
    status: 200,
    description: 'Followers list retrieved',
    type: Object,
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot view followers of private account',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async getFollowers(
    @CurrentUser() currentUser: UserResponse,
    @Param('userId') userId: string,
    @Query(ValidationPipe) pagination: PaginationDto,
  ): Promise<FollowListResponse> {
    return this.followService.getFollowers(userId, currentUser.id, pagination);
  }

  @Get('following/:userId')
  @ApiOperation({ summary: 'Lấy danh sách người đang theo dõi' })
  @ApiResponse({
    status: 200,
    description: 'Following list retrieved',
    type: Object,
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot view following of private account',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async getFollowing(
    @CurrentUser() currentUser: UserResponse,
    @Param('userId') userId: string,
    @Query(ValidationPipe) pagination: PaginationDto,
  ): Promise<FollowListResponse> {
    return this.followService.getFollowing(userId, currentUser.id, pagination);
  }

  @Get('requests')
  @ApiOperation({ summary: '(Private acc) Lấy danh sách yêu cầu theo dõi' })
  @ApiResponse({
    status: 200,
    description: 'Follow requests retrieved',
    type: [Object],
  })
  @ApiBearerAuth()
  async getFollowRequests(
    @CurrentUser() currentUser: UserResponse,
  ): Promise<FollowRequestResponse[]> {
    return this.followService.getFollowRequests(currentUser.id);
  }

  @Post('requests/:followId/accept')
  @ApiOperation({ summary: 'Chấp nhận yêu cầu follow' })
  @ApiResponse({ status: 200, description: 'Follow request accepted' })
  @ApiResponse({ status: 404, description: 'Follow request not found' })
  @ApiBearerAuth()
  async acceptFollowRequest(
    @CurrentUser() currentUser: UserResponse,
    @Param('followId') followId: string,
  ) {
    return this.followService.acceptFollowRequest(currentUser.id, followId);
  }

  @Post('requests/:followId/reject')
  @ApiOperation({ summary: 'Từ chối yêu cầu follow' })
  @ApiResponse({ status: 200, description: 'Follow request rejected' })
  @ApiResponse({ status: 404, description: 'Follow request not found' })
  @ApiBearerAuth()
  async rejectFollowRequest(
    @CurrentUser() currentUser: UserResponse,
    @Param('followId') followId: string,
  ) {
    return this.followService.rejectFollowRequest(currentUser.id, followId);
  }
}
