import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import {  
    createTag,
    getTags,
    getTagById,
    updateTag,
    deleteTag,
    getVideosByTag,
} from '../controllers/tag.controller';

const router = Router();

// Validation schema
const tagSchema = z.object({
    name: z.string().min(2).max(50),
});

/**
 * @route GET /api/v1/tags
 * @description Get all tags with optional pagination
 * @access Public
 * @returns {ApiResponse} List of tags with pagination
 */
router.get('/', asyncHandler(getTags));

/**
 * @route GET /api/v1/tags/:id
 * @description Get a specific tag by ID
 * @access Public
 * @param {string} id - Tag ID
 * @returns {ApiResponse} Tag details
 */
router.get('/:id', asyncHandler(getTagById));

/**
 * @route GET /api/v1/tags/:id/videos
 * @description Get videos associated with a specific tag
 * @access Public
 * @param {string} id - Tag ID
 * @returns {ApiResponse} List of videos with pagination
 */
router.get('/:id/videos', asyncHandler(getVideosByTag));

/**
 * @route POST /api/v1/tags
 * @description Create a new tag (admin only)
 * @access Private (requires authentication)
 * @param {Object} body - Tag data (name)
 * @returns {ApiResponse} Created tag
 */
router.post('/', verifyToken, validate(tagSchema), asyncHandler(createTag));

/**
 * @route PATCH /api/v1/tags/:id
 * @description Update a tag's name (admin only)
 * @access Private (requires authentication)
 * @param {string} id - Tag ID
 * @param {Object} body - Updated tag data (name)
 * @returns {ApiResponse} Updated tag
 */
router.patch('/:id', verifyToken, validate(tagSchema), asyncHandler(updateTag));

/**
 * @route DELETE /api/v1/tags/:id
 * @description Delete a tag (admin only)
 * @access Private (requires authentication)
 * @param {string} id - Tag ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:id', verifyToken, asyncHandler(deleteTag));

export default router;