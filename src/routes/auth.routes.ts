import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshToken
} from '../controllers/auth.controller';
import { authUpload } from '../middlewares/multer.middleware';
import { validate } from '../middlewares/validate.middleware';
import { verifyToken } from '../middlewares/auth.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
    username: z.string().min(3).regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().email(),
    fullName: z.string().min(1).max(50),
    password: z.string().min(8),
});

const loginSchema = z.object({
    username: z.string().min(3).regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().email(),
    password: z.string().min(8),
});

const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

/**
 * @route GET /api/v1/auth/register
 * @description Register a new user with avatar and optional cover image
 * @access Public
 * @param {Object} body - User registration data (username, email, fullName, password)
 * @param {File} avatar - User avatar image
 * @param {File} [coverImage] - Optional cover image
 * @returns {ApiResponse} Created user data
 */
router.post('/register', authUpload, validate(registerSchema), asyncHandler(registerUser));

/**
 * @route GET /api/v1/auth/login
 * @description Log in a user and return access/refresh tokens
 * @access Public
 * @param {Object} body - Login credentials (username, email, password)
 * @returns {ApiResponse} User data with tokens
 */
router.post('/login', validate(loginSchema), asyncHandler(loginUser));

/**
 * @route GET /api/v1/auth/logout
 * @description Log out the authenticated user and clear refresh token
 * @access Private (requires authentication)
 * @returns {ApiResponse} Success message
 */
router.post('/logout', verifyToken, asyncHandler(logoutUser));

/**
 * @route GET /api/v1/auth/refresh-token
 * @description Refresh access token using refresh token
 * @access Public
 * @param {Object} body - Refresh token
 * @returns {ApiResponse} New access token
 */
router.post('/refresh-token', validate(refreshTokenSchema), asyncHandler(refreshToken));

export default router;