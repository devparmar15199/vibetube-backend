import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';
import { singleThumbnail } from '../middlewares/multer.middleware';
import {  
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getPublicPlaylists
} from '../controllers/playlist.controller';

const router = Router();

// Validation schemas
const playlistSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    isPublic: z.boolean().optional(),
});

/**
 * @route GET /api/v1/playlists
 * @description Get all public playlists
 * @access Public
 * @returns {ApiResponse} List of public playlists with pagination
 */
router.get('/', asyncHandler(getPublicPlaylists));

/**
 * @route GET /api/v1/playlists/:id
 * @description Get a specific playlist by ID
 * @access Public
 * @param {string} id - Playlist ID
 * @returns {ApiResponse} Playlist details
 */
router.get('/:id', asyncHandler(getPlaylistById));

/**
 * @route POST /api/v1/playlists
 * @description Create a new playlist
 * @access Private (requires authentication)
 * @param {Object} body - Playlist data (name, description, isPublic)
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Created playlist
 */
router.post('/', verifyToken, singleThumbnail, validate(playlistSchema), asyncHandler(createPlaylist));

/**
 * @route GET /api/v1/playlists/user
 * @description Get playlists owned by the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of user's playlists with pagination
 */
router.get('/user', verifyToken, asyncHandler(getUserPlaylists));

/**
 * @route PATCH /api/v1/playlists/:id
 * @description Update a playlist's details
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {Object} body - Updated playlist data (name, description, isPublic)
 * @param {File} [thumbnail] - Optional thumbnail image
 * @returns {ApiResponse} Updated playlist
 */
router.patch('/:id', verifyToken, singleThumbnail, validate(playlistSchema), asyncHandler(updatePlaylist));

/**
 * @route DELETE /api/v1/playlists/:id
 * @description Delete a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @returns {ApiResponse} Success message
 */
router.delete('/:id', verifyToken, asyncHandler(deletePlaylist));

/**
 * @route POST /api/v1/playlists/:id/videos/:videoId
 * @description Add a video to a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {string} videoId - Video ID to add
 * @returns {ApiResponse} Updated playlist
 */
router.post('/:id/videos/:videoId', verifyToken, asyncHandler(addVideoToPlaylist));

/**
 * @route DELETE /api/v1/playlists/:id/videos/:videoId
 * @description Remove a video from a playlist
 * @access Private (requires authentication)
 * @param {string} id - Playlist ID
 * @param {string} videoId - Video ID to remove
 * @returns {ApiResponse} Updated playlist
 */
router.delete('/:id/videos/:videoId', verifyToken, asyncHandler(removeVideoFromPlaylist));

export default router;