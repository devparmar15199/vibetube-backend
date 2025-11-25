import type { Request, Response } from 'express';
import { User } from '../models/user.model';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import { uploadToCloudinary } from '../utils/cloudinarySetup';
import { config } from '../config';
import logger from '../utils/logger';

interface MulterFiles {
    avatar?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
}

interface RegisterRequestBody {
    username: string;
    email: string;
    fullName: string;
    password: string;
}

interface LoginRequestBody {
    username?: string;
    email?: string;
    password: string;
}

interface RefreshTokenBody {
    refreshToken: string;
}

// Generate access and refresh tokens
const getAccessAndRefreshToken = async (userId: string) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found while generating tokens', []);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
};

/**
 * @route POST /api/v1/auth/register
 * @desc Register a new user with avatar and optional cover image
 * @access Public
 * @param {Object} body - User registration data (username, email, fullName, password)
 * @param {File} avatar - User avatar image
 * @param {File} [coverImage] - Optional cover image
 * @returns {ApiResponse} Created user data with tokens
 */
export const registerUser = async (
    req: Request<{}, {}, RegisterRequestBody>,
    res: Response
) => {
    try {
        // Extract user details from request body
        const { username, email, fullName, password } = req.body;

        if ([username, email, fullName, password].some(field => !field?.trim())) {
            throw new ApiError(400, 'All fields (username, email, fullName, password) are required', []);
        }

        // Check for existing user with same username or email
        const existingUser = await User.findOne({
            $or: [
                { username: username.toLowerCase() },
                { email: email.toLowerCase() },
            ]
        });
        if (existingUser) {
            throw new ApiError(409, 'User with this email or username already exists', []);
        }

        // Upload to Cloudinary
        const files = req.files as MulterFiles;
        const avatarLocalPath = files?.avatar?.[0]?.path;
        const coverImageLocalPath = files?.coverImage?.[0]?.path;

        if (!avatarLocalPath) {
            throw new ApiError(400, 'Avatar file is required', []);
        }

        const avatar = await uploadToCloudinary(avatarLocalPath, 'image', {
            folder: 'avatars',
            transformation: [{ width: 200, height: 200, crop: 'fill' }],
        });
        const coverImage = coverImageLocalPath 
            ? await uploadToCloudinary(coverImageLocalPath, 'image', {
                folder: 'cover_images',
                transformation: [{ width: 1200, height: 400, crop: 'fill' }],
              })
            : null;

        if (!avatar?.secure_url) {
            throw new ApiError(500, 'Failed to upload avatar', []);
        }

        // Create user
        const user = await User.create({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            fullName,
            password,
            avatar: avatar.secure_url,
            coverImage: coverImage?.secure_url || undefined,
            subscribersCount: 0,
            isEmailVerified: false,
        });

        // Fetch user without sensitive fields
        const createdUser = await User.findById(user._id).select('-password -refreshToken');

        // Generate tokens
        const { accessToken, refreshToken } = await getAccessAndRefreshToken(user._id.toString());
        
        // Send response
        const cookieOptions = {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict' as const,
        };
        return res
            .status(201)
            .cookie('accessToken', accessToken, cookieOptions)
            .cookie('refreshToken', refreshToken, cookieOptions)
            .json(
                ApiResponse.success(
                    { user: createdUser, accessToken, refreshToken },
                    'User registered successfully',
                    201
                )
            );
    } catch (error: any) {
        logger.error(`Error in registerUser: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while registering user',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/auth/login
 * @desc Log in a user and return access/refresh tokens
 * @access Public
 * @param {Object} body - Login credentials (username or email, password)
 * @returns {ApiResponse} User data with tokens
 */
export const loginUser = async (
    req: Request<{}, {}, LoginRequestBody>,
    res: Response
) => {
    try {
        // Extract login credentials
        const { username, email, password } = req.body;

        if ((!username && !email) || !password) {
            throw new ApiError(400, 'Username or email and password are required', []);
        }

        // Find user by username or email
        const query: any = {};
        if (username) query.username = username.toLowerCase();
        if (email) query.email = email.toLowerCase();
        
        const user = await User.findOne(query).select('+password');
        if (!user) {
            throw new ApiError(404, 'User does not exist', []);
        }

        // Validate password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new ApiError(401, 'Invalid credentials', []);
        }

        // Generate tokens
        const { accessToken, refreshToken } = await getAccessAndRefreshToken(user._id.toString());

        // Fetch user without sensitive fields
        const loggedInUser = await User.findById(user._id).select('-password -refreshToken');

        // Send response
        const cookieOptions = {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict' as const,
        };
        return res
            .status(200)
            .cookie('accessToken', accessToken, cookieOptions)
            .cookie('refreshToken', refreshToken, cookieOptions)
            .json(
                ApiResponse.success(
                    { user: loggedInUser, accessToken, refreshToken },
                    'User logged in successfully',
                    200
                )
            );
    } catch (error: any) {
        logger.error(`Error in loginUser: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while logging in',
            error.errors || []
        );
    }   
};

/**
 * @route POST /api/v1/auth/logout
 * @description Log out the authenticated user and clear refresh token
 * @access Private (requires authentication)
 * @returns {ApiResponse} Success message
 */
export const logoutUser = async (
    req: Request, 
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        // Clear refresh token
        await User.findByIdAndUpdate(user._id, { $set: { refreshToken: undefined } });

        // Clear cookies
        const cookieOptions = {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict' as const,
        };
        res.clearCookie('accessToken', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);

        res.status(200).json(
            ApiResponse.success({}, 'User logged out successfully', 200)
        );
    } catch (error: any) {
        logger.error(`Error in logoutUser: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while logging out',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/auth/refresh-token
 * @description Refresh access token using refresh token
 * @access Public
 * @param {Object} body - Refresh token
 * @returns {ApiResponse} New access and refresh tokens
 */
export const refreshToken = async (
    req: Request<{}, {}, RefreshTokenBody>,
    res: Response
) => {
    try {
        const { refreshToken: incomingRefreshToken } = req.body;
        if (!incomingRefreshToken) {
            throw new ApiError(400, 'Refresh token is required', []);
        }

        // Verify refresh token
        const decoded = jwt.verify(
            incomingRefreshToken,
            config.refreshTokenSecret
        ) as { _id: string };

        const user = await User.findById(decoded._id).select('+refreshToken');
        if (!user || user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, 'Invalid or expired refresh token', []);
        }

        // Generate new tokens
        const { accessToken, refreshToken: newRefreshToken } = await getAccessAndRefreshToken(user._id.toString());

        // Send response
        const cookieOptions = {
            httpOnly: true,
            secure: config.nodeEnv === 'production',
            sameSite: 'strict' as const,
        };
        return res
            .status(200)
            .cookie('accessToken', accessToken, cookieOptions)
            .cookie('refreshToken', refreshToken, cookieOptions)
            .json(
                ApiResponse.success(
                    { accessToken, refreshToken: newRefreshToken },
                    'Tokens refreshed successfully',
                    200
                )
            );
    } catch (error: any) {
        logger.error(`Error in refreshToken: ${error.message}`);
        throw new ApiError(
            error.statusCode || 401,
            error.message || 'Invalid or expired refresh token',
            error.errors || []
        );
    }
};