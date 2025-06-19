import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { PostController } from '../controllers/postController';
import { handleValidationErrors } from '../middleware/errorHandler';
import {
  userValidations,
  postValidations,
  crudValidations,
} from '../middleware/validations';
import { apiLimiter, authLimiter } from '../middleware/security';
import {
  uploadAvatar,
  uploadCoverImage,
  validateUploadedFiles,
  handleUploadError,
} from '../middleware/upload';
import authRoutes from './auth';

const router = Router();

// Apply API rate limiting to all routes
router.use(apiLimiter);

// Auth routes with stricter rate limiting
router.use('/auth', authLimiter, authRoutes);

// User routes
// Public routes
router.get(
  '/users',
  crudValidations.pagination,
  handleValidationErrors,
  UserController.getAll,
);
router.get(
  '/users/:id',
  crudValidations.getById,
  handleValidationErrors,
  UserController.getById,
);
router.get(
  '/users/username/:username',
  userValidations.getByUsername,
  handleValidationErrors,
  UserController.getByUsername,
);
router.get(
  '/users/:id/followers',
  crudValidations.getById.concat(crudValidations.pagination),
  handleValidationErrors,
  UserController.getFollowers,
);
router.get(
  '/users/:id/following',
  crudValidations.getById.concat(crudValidations.pagination),
  handleValidationErrors,
  UserController.getFollowing,
);

// Follow/Unfollow routes
router.post(
  '/users/:id/follow',
  crudValidations.getById,
  handleValidationErrors,
  UserController.followUser,
);
router.delete(
  '/users/:id/follow',
  crudValidations.getById,
  handleValidationErrors,
  UserController.unfollowUser,
);

// Auth routes with stricter rate limiting
router.post(
  '/auth/register',
  authLimiter,
  userValidations.register,
  handleValidationErrors,
  UserController.register,
);

// Protected routes (require authentication - to be implemented)
router.put(
  '/users/:id/profile',
  crudValidations.getById.concat(userValidations.updateProfile),
  handleValidationErrors,
  UserController.updateProfile,
);

// Avatar upload route
router.post(
  '/users/:id/avatar',
  crudValidations.getById,
  uploadAvatar,
  validateUploadedFiles,
  handleValidationErrors,
  UserController.uploadAvatar,
  handleUploadError,
);

// Remove avatar route
router.delete(
  '/users/:id/avatar',
  crudValidations.getById,
  handleValidationErrors,
  UserController.removeAvatar,
);

// Cover image upload route
router.post(
  '/users/:id/cover',
  crudValidations.getById,
  uploadCoverImage,
  validateUploadedFiles,
  handleValidationErrors,
  UserController.uploadCoverImage,
  handleUploadError,
);

// Remove cover image route
router.delete(
  '/users/:id/cover',
  crudValidations.getById,
  handleValidationErrors,
  UserController.removeCoverImage,
);

router.put(
  '/users/:id/password',
  crudValidations.getById.concat(userValidations.changePassword),
  handleValidationErrors,
  UserController.changePassword,
);

// Deactivate account route
router.post(
  '/users/:id/deactivate',
  crudValidations.getById,
  handleValidationErrors,
  UserController.deactivateAccount,
);

router.delete(
  '/users/:id',
  crudValidations.deleteById,
  handleValidationErrors,
  UserController.delete,
);

// Post routes
// Public routes
router.get(
  '/posts',
  postValidations.getAll,
  handleValidationErrors,
  PostController.getAll,
);
router.get(
  '/posts/:id',
  crudValidations.getById,
  handleValidationErrors,
  PostController.getById,
);
router.get(
  '/posts/:id/replies',
  crudValidations.getById.concat(crudValidations.pagination),
  handleValidationErrors,
  PostController.getReplies,
);

// Protected routes (require authentication - to be implemented)
router.post(
  '/posts',
  postValidations.create,
  handleValidationErrors,
  PostController.create,
);
router.put(
  '/posts/:id',
  postValidations.update,
  handleValidationErrors,
  PostController.update,
);
router.delete(
  '/posts/:id',
  crudValidations.deleteById,
  handleValidationErrors,
  PostController.delete,
);
router.post(
  '/posts/:id/like',
  crudValidations.getById,
  handleValidationErrors,
  PostController.toggleLike,
);

export default router;
