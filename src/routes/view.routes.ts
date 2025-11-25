import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { logView, getVideoViews } from '../controllers/view.controller';

const router = Router();

/**
 * @route POST /api/v1/views/:videoId
 * @description Log a view for a video (user or IP-based)
 * @access Public
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message
 */
router.post('/:videoId', asyncHandler(logView));

/**
 * @route GET /api/v1/views/:videoId
 * @description Get view details for a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} List of views with pagination
 */
router.get('/:videoId', verifyToken, asyncHandler(getVideoViews));

export default router;