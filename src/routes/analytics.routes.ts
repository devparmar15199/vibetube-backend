import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { getVideoAnalytics, getUserAnalytics } from '../controllers/analytics.controller';

const router = Router();

/**
 * @route GET /api/v1/analytics/video/:videoId
 * @description Get analytics data for a specific video (views, likes, comments).
 * @access Private (requires authentication)
 * @param {string} videoId - The ID of the video to fetch analytics for
 * @returns {ApiResponse} Analytics data with daily breakdowns
 */
router.get('/video/:videoId', verifyToken, asyncHandler(getVideoAnalytics));

/**
 * @route GET /api/v1/analytics/user
 * @description Get aggregated analytics for all videos owned by the authenticated user.
 * @access Private (requires authentication)
 * @returns {ApiResponse} Aggregated analytics data for user's videos
 */
router.get('/user', verifyToken, asyncHandler(getUserAnalytics));

export default router;