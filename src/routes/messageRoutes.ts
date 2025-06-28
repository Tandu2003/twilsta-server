import { Router } from 'express';
import { MessageController } from '../controllers/messageController';
import { authenticateToken } from '../middleware/auth';
import { messageValidations, validateRequest } from '../middleware/validations';
import { uploadMessageFile } from '../middleware/upload';

const router = Router();

// All message routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/messages/:conversationId
 * @desc Get messages in a conversation
 * @access Private
 */
router.get(
  '/:conversationId',
  messageValidations.getMessages,
  validateRequest,
  MessageController.getMessages,
);

/**
 * @route POST /api/messages/:conversationId
 * @desc Send a new message
 * @access Private
 */
router.post(
  '/:conversationId',
  uploadMessageFile,
  messageValidations.sendMessage,
  validateRequest,
  MessageController.sendMessage,
);

/**
 * @route PUT /api/messages/:messageId
 * @desc Edit a message
 * @access Private
 */
router.put(
  '/:messageId',
  messageValidations.editMessage,
  validateRequest,
  MessageController.editMessage,
);

/**
 * @route DELETE /api/messages/:messageId
 * @desc Delete a message
 * @access Private
 */
router.delete(
  '/:messageId',
  messageValidations.deleteMessage,
  validateRequest,
  MessageController.deleteMessage,
);

/**
 * @route POST /api/messages/:messageId/react
 * @desc React to a message
 * @access Private
 */
router.post(
  '/:messageId/react',
  messageValidations.reactToMessage,
  validateRequest,
  MessageController.reactToMessage,
);

/**
 * @route POST /api/messages/:conversationId/read
 * @desc Mark messages as read
 * @access Private
 */
router.post(
  '/:conversationId/read',
  messageValidations.markAsRead,
  validateRequest,
  MessageController.markAsRead,
);

export default router;
