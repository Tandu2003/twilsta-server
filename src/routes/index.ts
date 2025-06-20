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

// Follow/Unfollow routes
router.post(
  '/users/:id/follow',
  crudValidations.getById,
  validateRequest,
  UserController.followUser,
);
router.delete(
  '/users/:id/follow',
  crudValidations.getById,
  validateRequest,
  UserController.unfollowUser,
);

// Auth routes without rate limiting
router.post('/auth/register', userValidations.register, validateRequest, UserController.register);

// Protected routes (require authentication - to be implemented)
router.put(
  '/users/:id/profile',
  crudValidations.getById.concat(userValidations.updateProfile),
  validateRequest,
  UserController.updateProfile,
);

// Avatar upload route - FIXED ORDER
router.post(
  '/users/:id/avatar',
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
  crudValidations.getById,
  validateRequest,
  UserController.removeAvatar,
);

// Cover image upload route - FIXED ORDER
router.post(
  '/users/:id/cover',
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
  crudValidations.getById,
  validateRequest,
  UserController.removeCoverImage,
);

router.put(
  '/users/:id/password',
  crudValidations.getById.concat(userValidations.changePassword),
  validateRequest,
  UserController.changePassword,
);

// Deactivate account route
router.post(
  '/users/:id/deactivate',
  crudValidations.getById,
  validateRequest,
  UserController.deactivateAccount,
);

router.delete('/users/:id', crudValidations.deleteById, validateRequest, UserController.delete);

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

// Protected routes (require authentication - to be implemented)
router.post('/posts', postValidations.create, validateRequest, PostController.create);
router.put('/posts/:id', postValidations.update, validateRequest, PostController.update);
router.delete('/posts/:id', crudValidations.deleteById, validateRequest, PostController.delete);
router.post('/posts/:id/like', crudValidations.getById, validateRequest, PostController.toggleLike);

// Post media management routes - FIXED ORDER
router.post(
  '/posts/:id/media',
  crudValidations.getById,
  validateRequest,
  uploadPostMedia,
  handleUploadError,
  validateUploadedFiles,
  PostController.addMedia,
);

router.delete(
  '/posts/:id/media',
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

// Protected routes (require authentication - to be implemented)
router.post('/comments', commentValidations.create, validateRequest, CommentController.create);

// Comment media upload route - FIXED ORDER
router.post(
  '/comments/media',
  commentValidations.create,
  validateRequest,
  uploadCommentMedia,
  handleUploadError,
  validateUploadedFiles,
  CommentController.create,
);

router.put('/comments/:id', commentValidations.update, validateRequest, CommentController.update);

router.delete(
  '/comments/:id',
  crudValidations.deleteById,
  validateRequest,
  CommentController.delete,
);

router.post(
  '/comments/:id/like',
  crudValidations.getById,
  validateRequest,
  CommentController.toggleLike,
);

// Comment media management routes - FIXED ORDER
router.post(
  '/comments/:id/media',
  crudValidations.getById,
  validateRequest,
  uploadCommentMedia,
  handleUploadError,
  validateUploadedFiles,
  CommentController.addMedia,
);

router.delete(
  '/comments/:id/media',
  commentValidations.removeMedia,
  validateRequest,
  CommentController.removeMedia,
);

export default router;
