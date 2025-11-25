import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import {  
    addComment,
    updateComment,
    deleteComment,
    getComments
} from '../controllers/comment.controller';

const router = Router();

// Vaidation schemas
const commentSchema = z.object({
    content: z.string().min(1).max(500),
});

/**
 * @route GET /api/v1/comments/:type/:id
 * @description Get comments for a video or post
 * @access Public
 * @param {string} type - Content type (video or post) 
 * @param {string} id - ID of the video or post 
 * @returns {ApiResponse} List of comments with pagination
 */
router.get('/:type/:id', asyncHandler(getComments));

/**
 * @route POST /api/v1/comments/:type/:id
 * @description Add a comment to a video or post
 * @access Private (requires authentication)
 * @param {string} type - Content type (video or post) 
 * @param {string} id - ID of the video or post
 * @param {Object} body - Comment data (content)
 * @returns {ApiResponse} Created comment
 */
router.post('/:type/:id', verifyToken, validate(commentSchema), asyncHandler(addComment));

/**
 * @route PATCH /api/v1/comments/:commentId
 * @description Update a comment's content
 * @access Private (requires authentication) 
 * @param {string} commentId - ID of the comment to update
 * @param {Object} body - Updated comment data (content)
 * @returns {ApiResponse} Updated comment
 */
router.patch('/:commentId', verifyToken, validate(commentSchema), asyncHandler(updateComment));

/**
 * @route DELETE /api/v1/comments/:commentId
 * @description Delete a comment and its replies
 * @access Private (requires authentication) 
 * @param {string} commentId - ID of the comment to delete
 * @returns {ApiResponse} Success message
 */
router.delete('/:commentId', verifyToken, asyncHandler(deleteComment));

export default router;