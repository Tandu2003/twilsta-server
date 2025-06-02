export interface UserProfile {
  id: string;
  username: string;
  email?: string; // Only included if user owns profile or is admin
  fullName?: string;
  bio?: string;
  avatar?: string;
  website?: string;
  phone?: string;
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithStats extends UserProfile {
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

export interface UserStats {
  postsCount: number;
  followersCount: number;
  followingCount: number;
}

export interface UserSearchResult {
  id: string;
  username: string;
  fullName?: string;
  avatar?: string;
  isVerified: boolean;
  isPrivate: boolean;
}

export interface UserSearchResponse {
  users: UserSearchResult[];
  hasMore: boolean;
  total: number;
}

export interface FollowListItem {
  id: string;
  username: string;
  fullName?: string;
  avatar?: string;
  isVerified: boolean;
  isPrivate: boolean;
  isFollowing?: boolean; // Whether current user follows this user
  isFollowedBy?: boolean; // Whether this user follows current user
}

export interface FollowListResponse {
  users: FollowListItem[];
  hasMore: boolean;
  nextCursor?: string;
  total: number;
}

export interface UpdateProfileResult {
  user: UserProfile;
  message: string;
}
