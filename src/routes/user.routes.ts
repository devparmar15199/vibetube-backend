import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import { singleAvatar, singleCoverImage } from '../middlewares/multer.middleware';
import { 
    getMyProfile,
    getUserById,
    updateProfile,
    updateAvatar,
    updateCoverImage,
    getUserVideos,
    searchUsers,
    changePassword
} from '../controllers/user.controller';

const router = Router();

// Validation schemas
const profileSchema = z.object({
    fullName: z.string().min(1).max(50).optional(),
    bio: z.string().max(200).optional(),
});

const passwordSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
});

/**
 * @route GET /api/v1/users/me
 * @description Get the authenticated user's profile
 * @access Private (requires authentication)
 * @returns {ApiResponse} User profile data
 */
router.get('/me', verifyToken, asyncHandler(getMyProfile));

/**
 * @route PATCH /api/v1/users/me
 * @description Update the authenticated user's profile (fullName, bio)
 * @access Private (requires authentication)
 * @param {Object} body - Updated profile data
 * @returns {ApiResponse} Updated user profile
 */
router.patch('/me', verifyToken, validate(profileSchema), asyncHandler(updateProfile));

/**
 * @route POST /api/v1/users/change-password
 * @description Change the authenticated user's password
 * @access Private (requires authentication)
 * @param {Object} body - Current and new password
 * @returns {ApiResponse} Success message
 */
router.post('/change-password', verifyToken, validate(passwordSchema), asyncHandler(changePassword));

/**
 * @route PATCH /api/v1/users/avatar
 * @description Update the authenticated user's avatar
 * @access Private (requires authentication)
 * @param {File} avatar - New avatar image
 * @returns {ApiResponse} Updated user profile
 */
router.patch('/avatar', verifyToken, singleAvatar, asyncHandler(updateAvatar));

/**
 * @route PATCH /api/v1/users/cover-image
 * @description Update the authenticated user's cover image
 * @access Private (requires authentication)
 * @param {File} coverImage - New cover image
 * @returns {ApiResponse} Updated user profile
 */
router.patch('/cover-image', verifyToken, singleCoverImage, asyncHandler(updateCoverImage));

/**
 * @route GET /api/v1/users/search
 * @description Search users by username, fullName, or bio
 * @access Public
 * @param {string} query - Search query parameter
 * @returns {ApiResponse} List of matching users with pagination
 */
router.get('/search', asyncHandler(searchUsers));

/**
 * @route GET /api/v1/users/:id
 * @description Get a user's profile by ID
 * @access Public
 * @param {string} id - User ID
 * @returns {ApiResponse} User profile data
 */
router.get('/:id', asyncHandler(getUserById));

/**
 * @route GET /api/v1/users/:id/videos
 * @description Get videos uploaded by a specific user
 * @access Public
 * @param {string} id - User ID
 * @returns {ApiResponse} List of user's videos with pagination
 */
router.get('/:id/videos', asyncHandler(getUserVideos));

export default router;