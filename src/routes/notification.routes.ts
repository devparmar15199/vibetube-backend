import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notification.controller';

const router = Router();

/**
 * @route GET /api/v1/notifications
 * @description Get notifications for the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of notifications with pagination
 */
router.get('/', verifyToken, asyncHandler(getNotifications));

/**
 * @route POST /api/v1/notifications/:id/read
 * @description Mark a specific notification as read
 * @access Private (requires authentication)
 * @param {string} id - Notification ID
 * @returns {ApiResponse} Updated notification
 */
router.post('/:id/read', verifyToken, asyncHandler(markAsRead));

/**
 * @route PATCH /api/v1/notifications/all/read
 * @description Mark all notifications as read for the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} Success message
 */
router.patch('/all/read', verifyToken, asyncHandler(markAllAsRead));

/**
 * @route DELETE /api/v1/notifications/:id
 * @description Delete a specific notification
 * @access Private (requires authentication)
 * @param {string} id - Notification ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:id', verifyToken, asyncHandler(deleteNotification));

export default router;