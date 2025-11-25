import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import {
    createPost,
    updatePost,
    deletePost,
    getUserPosts,
    getPostById,
    getFeed
} from '../controllers/post.controller';

const router = Router();

// Validation schemas
const postSchema = z.object({
    content: z.string().min(1).max(1000),
});

/**
 * @route GET /api/v1/posts
 * @description Get the social feed of posts
 * @access Public
 * @returns {ApiResponse} List of posts with pagination
 */
router.get('/', asyncHandler(getFeed));

/**
 * @route GET /api/v1/posts/:id
 * @description Get a specific post by ID
 * @access Public
 * @param {string} id - Post ID
 * @returns {ApiResponse} Posts details
 */
router.get('/:id', asyncHandler(getPostById));

/**
 * @route GET /api/v1/posts/users/:userId
 * @description Get posts by a specific user
 * @access Public
 * @param {string} userId - User ID
 * @returns {ApiResponse} List of user's posts with pagination
 */
router.get('/users/:userId', asyncHandler(getUserPosts));

/**
 * @route POST /api/v1/posts
 * @description Create a new post
 * @access Private (requires authentication)
 * @param {Object} body - Post data (content)
 * @returns {ApiResponse} Created post
 */
router.post('/', verifyToken, validate(postSchema), asyncHandler(createPost));

/**
 * @route PATCH /api/v1/posts/:id
 * @description Update a post's content
 * @access Private (requires authentication)
 * @param {string} id - Post ID
 * @param {Object} body - Updated post data (content)
 * @returns {ApiResponse} Updated post
 */
router.patch('/:id', verifyToken, validate(postSchema), asyncHandler(updatePost));

/**
 * @route DELETE /api/v1/posts/:id
 * @description Delete a post
 * @access Private (requires authentication)
 * @param {string} id - Post ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:id', verifyToken, asyncHandler(deletePost));

export default router;