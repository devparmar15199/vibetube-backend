import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import {  
    toggleLike,
    getLikesCount,
    getLikedByUser,
    isLiked
} from '../controllers/like.controller';

const router = Router();

/**
 * @route GET /api/v1/likes/:type/:id/count
 * @description Get the number of likes for a video, post, or comment
 * @access Public
 * @param {string} type - Content type (video, post, or comment) 
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Like count
 */
router.get('/:type/:id/count', asyncHandler(getLikesCount));

/**
 * @route POST /api/v1/likes/:type/:id
 * @description Toggle like status for a video, post, or comment
 * @access Private (requires authentication)
 * @param {string} type - Content type (video, post, or comment) 
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Like status (liked or unliked)
 */
router.post('/:type/:id', verifyToken,  asyncHandler(toggleLike));

/**
 * @route GET /api/v1/likes/:type/:id/is-liked
 * @description Check if the authenticated user liked a video, post, or comment
 * @access Private (requires authentication)
 * @param {string} type - Content type (video, post, or comment) 
 * @param {string} id - ID of the content
 * @returns {ApiResponse} Boolean indicating if liked
 */
router.get('/:type/:id/is-liked', verifyToken, asyncHandler(isLiked));

/**
 * @route GET /api/v1/likes/user
 * @description Get all content liked by the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of liked content with pagination
 */
router.get('/user', verifyToken, asyncHandler(getLikedByUser));

export default router;