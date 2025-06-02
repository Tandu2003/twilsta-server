import { UserResponse } from '../../auth/interfaces/auth.interface';

export interface FollowResponse {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: Date;
  follower?: UserResponse;
  following?: UserResponse;
}

export interface FollowStatusResponse {
  isFollowing: boolean;
  isPending: boolean;
  canFollow: boolean;
}

export interface FollowListResponse {
  users: UserWithFollowInfo[];
  pagination: {
    hasNext: boolean;
    cursor?: string;
  };
}

export interface UserWithFollowInfo {
  id: string;
  username: string;
  fullName?: string;
  avatar?: string;
  isVerified: boolean;
  isPrivate: boolean;
  followStatus?: FollowStatus;
  createdAt: Date;
}

export interface FollowRequestResponse {
  id: string;
  user: UserResponse;
  createdAt: Date;
}

export interface PaginationQuery {
  limit?: number;
  cursor?: string;
}

export enum FollowStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
}
