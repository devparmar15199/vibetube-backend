import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import { uploadVideoAndThumbnail } from '../middlewares/multer.middleware';
import { 
    uploadVideo,
    getAllVideos,
    getVideoById, 
    updateVideo,
    deleteVideo,
    togglePublishStatus
} from '../controllers/video.controller';
import { VIDEO_CATEGORIES } from '../utils/constants';

const router = Router();

// Validation schema
const videoSchema = z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    category: z.enum(VIDEO_CATEGORIES),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
    subscribersOnly: z.boolean().optional(),
});

/**
 * @route GET /api/v1/videos
 * @description Get all published videos
 * @access Public
 * @returns {ApiResponse} List of videos with pagination
 */
router.get('/', asyncHandler(getAllVideos));

/**
 * @route GET /api/v1/videos/:videoId
 * @description Get a specific video by ID
 * @access Public
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Video details
 */
router.get('/:videoId', asyncHandler(getVideoById));

/**
 * @route POST /api/v1/videos
 * @description Upload a new video with thumbnail
 * @access Private (requires authentication)
 * @param {Object} body - Video data (title, description, category, tags, isPublished, subscribersOnly)
 * @param {File} videoFile - Video file
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Created video
 */
router.post('/', verifyToken, uploadVideoAndThumbnail, validate(videoSchema), asyncHandler(uploadVideo));

/**
 * @route PATCH /api/v1/videos/:videoId
 * @description Update a video's details
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @param {Object} body - Updated video data
 * @returns {ApiResponse} Updated video
 */
router.patch('/:videoId', verifyToken, validate(videoSchema), asyncHandler(updateVideo));

/**
 * @route DELETE /api/v1/videos/:videoId
 * @description Delete a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:videoId', verifyToken, asyncHandler(deleteVideo));

/**
 * @route POST /api/v1/videos/:videoId/publish
 * @description Toggle the publish status of a video
 * @access Private (requires authentication)
 * @param {string} videoId - Video ID
 * @returns {ApiResponse} Updated video
 */
router.post('/:videoId/publish', verifyToken, asyncHandler(togglePublishStatus));

export default router;
