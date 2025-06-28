import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';
import { conversationValidations, validateRequest } from '../middleware/validations';
import {
  uploadConversationAvatar,
  validateUploadedFiles,
  handleUploadError,
} from '../middleware/upload';

const router = Router();

// All conversation routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/conversations
 * @desc    Get user's conversations with pagination
 * @access  Private
 */
router.get(
  '/',
  conversationValidations.getConversations,
  validateRequest,
  ConversationController.getConversations,
);

/**
 * @route   GET /api/conversations/:id
 * @desc    Get conversation details
 * @access  Private
 */
router.get(
  '/:conversationId',
  conversationValidations.getConversation,
  validateRequest,
  ConversationController.getConversation,
);

/**
 * @route   POST /api/conversations
 * @desc    Create new conversation
 * @access  Private
 */
router.post(
  '/',
  uploadConversationAvatar,
  validateUploadedFiles,
  conversationValidations.createConversation,
  validateRequest,
  ConversationController.createConversation,
  handleUploadError,
);

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation
 * @access  Private
 */
router.put(
  '/:conversationId',
  uploadConversationAvatar,
  validateUploadedFiles,
  conversationValidations.updateConversation,
  validateRequest,
  ConversationController.updateConversation,
  handleUploadError,
);

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete conversation (group only)
 * @access  Private
 */
router.delete(
  '/:conversationId',
  conversationValidations.deleteConversation,
  validateRequest,
  ConversationController.deleteConversation,
);

/**
 * @route   POST /api/conversations/:id/participants
 * @desc    Add participants to conversation
 * @access  Private
 */
router.post(
  '/:conversationId/participants',
  conversationValidations.addParticipants,
  validateRequest,
  ConversationController.addParticipants,
);

/**
 * @route   DELETE /api/conversations/:id/participants/:userId
 * @desc    Remove participant from conversation
 * @access  Private
 */
router.delete(
  '/:conversationId/participants/:participantId',
  conversationValidations.removeParticipant,
  validateRequest,
  ConversationController.removeParticipant,
);

/**
 * @route   POST /api/conversations/:conversationId/leave
 * @desc    Leave conversation
 * @access  Private
 */
router.post(
  '/:conversationId/leave',
  conversationValidations.leaveConversation,
  validateRequest,
  ConversationController.leaveConversation,
);

export default router;
