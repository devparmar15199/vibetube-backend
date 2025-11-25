import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import {
    addToWatchHistory,
    getWatchHistory,
    clearWatchHistory,
    removeFromWatchHistory
} from '../controllers/watchHistory.controller';

const router = Router();

/**
 * @route POST /api/v1/watch-history/:videoId
 * @description Add a video to the authenticated user's watch history
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Updated watch history entry
 */
router.post('/:videoId', verifyToken, asyncHandler(addToWatchHistory));

/**
 * @route GET /api/v1/watch-history
 * @description Get the authenticated user's watch history
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of watch history entries with pagination
 */
router.get('/', verifyToken, asyncHandler(getWatchHistory));

/**
 * @route DELETE /api/v1/watch-history
 * @description Clear the authenticated user's watch history
 * @access Private (requires authentication)
 * @returns {ApiResponse} Success message
 */
router.delete('/', verifyToken, asyncHandler(clearWatchHistory));

/**
 * @route DELETE /api/v1/watch-history/:videoId
 * @description Remove a specific video from the authenticated user's watch history
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:videoId', verifyToken, asyncHandler(removeFromWatchHistory));

export default router;