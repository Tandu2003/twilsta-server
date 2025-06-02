import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseFilters,
  UseInterceptors,
  ValidationPipe,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { UserResponse } from '../auth/interfaces/auth.interface';
import {
  UpdateProfileDto,
  ChangePasswordDto,
  UserSearchQueryDto,
  FollowListQueryDto,
  UserIdParamDto,
  UsernameParamDto,
} from './dto/user.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseFilters(HttpExceptionFilter)
@UseInterceptors(TransformInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 8. GET /api/users - Search users (Public)
  @Public()
  @Get()
  @ApiOperation({ summary: 'Tìm kiếm user bằng username hoặc từ khoá' })
  @ApiQuery({ name: 'q', required: false, description: 'Search keyword' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination',
  })
  @ApiResponse({ status: 200, description: 'Users found successfully' })
  async searchUsers(@Query(ValidationPipe) query: UserSearchQueryDto) {
    return this.usersService.searchUsers(query);
  }

  // 3. GET /api/users/me - Get current user profile
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin của chính user đang đăng nhập' })
  @ApiResponse({ status: 200, description: 'Current user profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBearerAuth()
  async getCurrentUser(@CurrentUser() user: UserResponse) {
    return this.usersService.getCurrentUser(user.id);
  }

  // 4. PUT /api/users/me - Update profile
  @Put('me')
  @ApiOperation({ summary: 'Cập nhật thông tin cá nhân' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async updateProfile(
    @CurrentUser() user: UserResponse,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  // 5. POST /api/users/me/change-password - Change password
  @Post('me/change-password')
  @ApiOperation({ summary: 'Đổi mật khẩu' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async changePassword(
    @CurrentUser() user: UserResponse,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  // 6. POST /api/users/me/avatar - Upload avatar
  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload hoặc cập nhật avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Avatar updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @CurrentUser() user: UserResponse,
    @UploadedFile() file: any,
  ) {
    // TODO: Implement file upload logic (e.g., to S3, Cloudinary, etc.)
    // For now, this is a placeholder that would work with a file upload service
    if (!file) {
      throw new Error('No file uploaded');
    }

    // Example: Save file and get URL
    const avatarUrl = `https://example.com/avatars/${file.filename}`;

    return this.usersService.updateAvatar(user.id, avatarUrl);
  }

  // 7. DELETE /api/users/me - Delete account
  @Delete('me')
  @ApiOperation({ summary: 'Xoá tài khoản người dùng' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBearerAuth()
  async deleteAccount(@CurrentUser() user: UserResponse) {
    return this.usersService.deleteAccount(user.id);
  }

  // 2. GET /api/users/username/:username - Get user by username
  @Get('username/:username')
  @ApiOperation({ summary: 'Lấy thông tin user theo username' })
  @ApiParam({ name: 'username', description: 'Username of the user' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getUserByUsername(
    @Param() params: UsernameParamDto,
    @CurrentUser() currentUser?: UserResponse,
  ) {
    return this.usersService.getUserByUsername(
      params.username,
      currentUser?.id,
    );
  }

  // 1. GET /api/users/:userId - Get user by ID
  @Get(':userId')
  @ApiOperation({ summary: 'Lấy thông tin user theo userId' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getUserById(
    @Param() params: UserIdParamDto,
    @CurrentUser() currentUser?: UserResponse,
  ) {
    return this.usersService.getUserById(params.userId, currentUser?.id);
  }

  // 9. GET /api/users/:userId/stats - Get user stats
  @Get(':userId/stats')
  @ApiOperation({
    summary: 'Lấy thống kê user (postsCount, followersCount, followingCount)',
  })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiResponse({ status: 200, description: 'User stats retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getUserStats(
    @Param() params: UserIdParamDto,
    @CurrentUser() currentUser?: UserResponse,
  ) {
    return this.usersService.getUserStats(params.userId, currentUser?.id);
  }

  // 10. GET /api/users/:userId/followers - Get followers list
  @Get(':userId/followers')
  @ApiOperation({ summary: 'Lấy danh sách follower' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
  })
  @ApiResponse({ status: 200, description: 'Followers list retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getFollowers(
    @Param() params: UserIdParamDto,
    @Query(ValidationPipe) query: FollowListQueryDto,
    @CurrentUser() currentUser?: UserResponse,
  ) {
    return this.usersService.getFollowers(
      params.userId,
      query,
      currentUser?.id,
    );
  }

  // 11. GET /api/users/:userId/following - Get following list
  @Get(':userId/following')
  @ApiOperation({ summary: 'Lấy danh sách đang theo dõi' })
  @ApiParam({ name: 'userId', description: 'ID of the user' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
  })
  @ApiResponse({ status: 200, description: 'Following list retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Profile is private' })
  async getFollowing(
    @Param() params: UserIdParamDto,
    @Query(ValidationPipe) query: FollowListQueryDto,
    @CurrentUser() currentUser?: UserResponse,
  ) {
    return this.usersService.getFollowing(
      params.userId,
      query,
      currentUser?.id,
    );
  }
}
