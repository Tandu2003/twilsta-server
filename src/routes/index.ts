import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { PostController } from '../controllers/postController';
import { CommentController } from '../controllers/commentController';
import {
  userValidations,
  postValidations,
  commentValidations,
  crudValidations,
  validateRequest,
} from '../middleware/validations';
// Rate limiting removed as requested
import {
  uploadAvatar,
  uploadCoverImage,
  uploadPostMedia,
  uploadCommentMedia,
  validateUploadedFiles,
  handleUploadError,
} from '../middleware/upload';
import { authenticateToken } from '../middleware/auth';
import authRoutes from './auth';
import messageRoutes from './messageRoutes';
import conversationRoutes from './conversationRoutes';

const router = Router();

// Rate limiting removed - no restrictions
// Auth routes without rate limiting
router.use('/auth', authRoutes);

// Message and Conversation routes
router.use('/messages', messageRoutes);
router.use('/conversations', conversationRoutes);

// User routes
// Public routes
router.get('/users', crudValidations.pagination, validateRequest, UserController.getAll);
router.get('/users/:id', crudValidations.getById, validateRequest, UserController.getById);
router.get(
  '/users/username/:username',
  userValidations.getByUsername,
  validateRequest,
  UserController.getByUsername,
);
router.get(
  '/users/:id/followers',
  crudValidations.getById.concat(crudValidations.pagination),
  validateRequest,
  UserController.getFollowers,
);
router.get(
  '/users/:id/following',
  crudValidations.getById.concat(crudValidations.pagination),
  validateRequest,
  UserController.getFollowing,
);

// Follow/Unfollow routes - require authentication
router.post(
  '/users/:id/follow',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  UserController.followUser,
);
router.delete(
  '/users/:id/follow',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  UserController.unfollowUser,
);

// Auth routes without rate limiting
router.post('/auth/register', userValidations.register, validateRequest, UserController.register);

// Protected routes (require authentication)
router.put(
  '/users/:id/profile',
  authenticateToken,
  crudValidations.getById.concat(userValidations.updateProfile),
  validateRequest,
  UserController.updateProfile,
);

// Avatar upload route - FIXED ORDER
router.post(
  '/users/:id/avatar',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  uploadAvatar,
  handleUploadError,
  validateUploadedFiles,
  UserController.uploadAvatar,
);

// Remove avatar route
router.delete(
  '/users/:id/avatar',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  UserController.removeAvatar,
);

// Cover image upload route - FIXED ORDER
router.post(
  '/users/:id/cover',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  uploadCoverImage,
  handleUploadError,
  validateUploadedFiles,
  UserController.uploadCoverImage,
);

// Remove cover image route
router.delete(
  '/users/:id/cover',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  UserController.removeCoverImage,
);

router.put(
  '/users/:id/password',
  authenticateToken,
  crudValidations.getById.concat(userValidations.changePassword),
  validateRequest,
  UserController.changePassword,
);

// Deactivate account route
router.post(
  '/users/:id/deactivate',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  UserController.deactivateAccount,
);

router.delete(
  '/users/:id',
  authenticateToken,
  crudValidations.deleteById,
  validateRequest,
  UserController.delete,
);

// Post routes
// Public routes
router.get('/posts', postValidations.getAll, validateRequest, PostController.getAll);
router.get('/posts/:id', crudValidations.getById, validateRequest, PostController.getById);
router.get(
  '/posts/:id/replies',
  crudValidations.getById.concat(crudValidations.pagination),
  validateRequest,
  PostController.getReplies,
);

// Protected routes (require authentication)
router.post(
  '/posts',
  authenticateToken,
  postValidations.create,
  validateRequest,
  PostController.create,
);
router.post(
  '/posts/media',
  authenticateToken,
  uploadPostMedia,
  handleUploadError,
  validateUploadedFiles,
  PostController.create,
);
router.put(
  '/posts/:id',
  authenticateToken,
  postValidations.update,
  validateRequest,
  PostController.update,
);
router.delete(
  '/posts/:id',
  authenticateToken,
  crudValidations.deleteById,
  validateRequest,
  PostController.delete,
);
router.post(
  '/posts/:id/like',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  PostController.toggleLike,
);
router.get(
  '/posts/:id/like-status',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  PostController.getLikeStatus,
);

// Post media management routes - FIXED ORDER
router.post(
  '/posts/:id/media',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  uploadPostMedia,
  handleUploadError,
  validateUploadedFiles,
  PostController.addMedia,
);

router.delete(
  '/posts/:id/media',
  authenticateToken,
  crudValidations.getById.concat(postValidations.removeMedia),
  validateRequest,
  PostController.removeMedia,
);

// Comment routes
// Public routes
router.get(
  '/posts/:postId/comments',
  commentValidations.getByPost,
  validateRequest,
  CommentController.getCommentsByPost,
);

router.get(
  '/comments/:commentId/replies',
  commentValidations.getReplies,
  validateRequest,
  CommentController.getReplies,
);

// Protected routes (require authentication)
router.post(
  '/comments',
  authenticateToken,
  commentValidations.create,
  validateRequest,
  CommentController.create,
);

// Comment media upload route - FIXED ORDER
router.post(
  '/comments/media',
  authenticateToken,
  commentValidations.create,
  validateRequest,
  uploadCommentMedia,
  handleUploadError,
  validateUploadedFiles,
  CommentController.create,
);

router.put(
  '/comments/:id',
  authenticateToken,
  commentValidations.update,
  validateRequest,
  CommentController.update,
);

router.delete(
  '/comments/:id',
  authenticateToken,
  crudValidations.deleteById,
  validateRequest,
  CommentController.delete,
);

router.post(
  '/comments/:id/like',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  CommentController.toggleLike,
);

// Comment media management routes - FIXED ORDER
router.post(
  '/comments/:id/media',
  authenticateToken,
  crudValidations.getById,
  validateRequest,
  uploadCommentMedia,
  handleUploadError,
  validateUploadedFiles,
  CommentController.addMedia,
);

router.delete(
  '/comments/:id/media',
  authenticateToken,
  commentValidations.removeMedia,
  validateRequest,
  CommentController.removeMedia,
);

export default router;
