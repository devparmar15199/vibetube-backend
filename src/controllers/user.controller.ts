import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User, type IUser } from '../models/user.model';
import { Video } from '../models/video.model';
import { uploadToCloudinary } from '../utils/cloudinarySetup';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface UpdateProfileBody {
    fullName?: string;
    bio?: string;
}

interface ChangePasswordBody {
    currentPassword: string;
    newPassword: string;
}

interface SearchQueryParams {
    query?: string;
    page?: string;
    limit?: string;
}

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route GET /api/v1/users/me
 * @description Get the profile of the authenticated user
 * @access Private (requires authentication)
 * @returns {ApiResponse} User profile data
 */
export const getMyProfile = async (
    req: Request<{}, {}, {}, {}, { user: IUser }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        // Fetch user without sensitive fields
        const profile = await User.findById(user._id)
            .select('-password -refreshToken -watchHistory')
            .lean();

        if (!profile) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Fetched profile for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { user: profile },
                'Profile fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getMyProfile: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user profile',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/users/:id
 * @description Get a user's profile by ID
 * @access Public
 * @param {string} id - User ID
 * @returns {ApiResponse} User profile data
 */
export const getUserById = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const { id } = req.params;

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid user ID', []);
        }

        const userId = new mongoose.Types.ObjectId(id);

        const user = await User.findById(userId)
            .select('-password -refreshToken -watchHistory')
            .lean();

        if (!user) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Fetched user ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { user },
                'User fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getUserById: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user by ID',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/users/me
 * @description Update the authenticated user's profile (fullName, bio)
 * @access Private (requires authentication)
 * @param {Object} body - Updated profile data
 * @returns {ApiResponse} Updated user profile
 */
export const updateProfile = async (
    req: Request<{}, {}, UpdateProfileBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { fullName, bio } = req.body;

        if (!fullName && !bio) {
            throw new ApiError(400, 'At least one field (fullName or bio) is required', []);
        }

        const updateData: Partial<UpdateProfileBody> = {};
        if (fullName?.trim()) updateData.fullName = fullName.trim();
        if (bio !== undefined) updateData.bio = bio?.trim() || '';

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            updateData,
            { new: true, runValidators: true }
        )
            .select('-password -refreshToken')
            .lean();

        if (!updatedUser) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Updated profile for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { user: updatedUser },
                'Profile updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateProfile: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating profile',
            error.errors || []
        );
    }
};

/**
 * @route POST /api/v1/users/change-password
 * @description Change the authenticated user's password
 * @access Private (requires authentication)
 * @param {Object} body - Current and new password
 * @returns {ApiResponse} Success message
 */
export const changePassword = async (
    req: Request<{}, {}, ChangePasswordBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { currentPassword, newPassword } = req.body;

        // Validation is handled by middleware, but double-check
        if (!currentPassword || !newPassword) {
            throw new ApiError(400, 'Current password and new password are required', []);
        }

        const userWithPassword = await User.findById(user._id).select('+password');
        if (!userWithPassword) {
            throw new ApiError(404, 'User not found', []);
        }

        const isPasswordValid = await userWithPassword.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new ApiError(400, 'Current password is incorrect', []);
        }

        userWithPassword.password = newPassword;
        await userWithPassword.save();

        logger.info(`Password changed for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Password changed successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in changePassword: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating password',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/users/avatar
 * @description Update the authenticated user's avatar
 * @access Private (requires authentication)
 * @param {File} avatar - New avatar image
 * @returns {ApiResponse} Updated avatar URL
 */
export const updateAvatar = async (
    req: Request<{}, {}, {}, {}, { user: IUser }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const file = req.file;
        if (!file) {
            throw new ApiError(400, 'Avatar file is required', []);
        }

        const avatar = await uploadToCloudinary(file.path, 'image');
        if (!avatar?.secure_url) {
            throw new ApiError(500, 'Failed to upload avatar', []);
        }

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { avatar: avatar.secure_url },
            { new: true }
        )
            .select('-password -refreshToken')
            .lean();

        if (!updatedUser) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Avatar updated for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { avatar: avatar.secure_url },
                'Avatar updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateAvatar: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating avatar',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/users/cover-image
 * @description Update the authenticated user's cover image
 * @access Private (requires authentication)
 * @param {File} coverImage - New cover image
 * @returns {ApiResponse} Updated cover image URL
 */
export const updateCoverImage = async (
    req: Request<{}, {}, {}, {}, { user: IUser }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const file = req.file;
        if (!file) {
            throw new ApiError(400, 'Cover image file is required', []);
        }

        const coverImage = await uploadToCloudinary(file.path, 'image');
        if (!coverImage?.secure_url) {
            throw new ApiError(500, 'Failed to upload cover image', []);
        }

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { coverImage: coverImage.secure_url },
            { new: true }
        )
            .select('-password -refreshToken')
            .lean();

        if (!updatedUser) {
            throw new ApiError(404, 'User not found', []);
        }

        logger.info(`Cover image updated for user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { coverImage: coverImage.secure_url },
                'Cover image updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateCoverImage: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating cover image',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/users/:id/videos
 * @description Get videos uploaded by a specific user
 * @access Public
 * @param {string} id - User ID
 * @returns {ApiResponse} List of user's videos with pagination
 */
export const getUserVideos = async (
    req: Request<{ id: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid user ID', []);
        }

        const ownerId = new mongoose.Types.ObjectId(id);

        // Check if user exists
        const user = await User.findById(ownerId).select('_id');
        if (!user) {
            throw new ApiError(404, 'User not found', []);
        }

        const match: any = {
            owner: ownerId,
            isPublished: true,
        };

        const videos = await Video.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }]
                }
            },
            { $unwind: '$owner' },
            { 
                $project: {
                    title: 1,
                    thumbnail: 1,
                    duration: 1,
                    views: 1,
                    likesCount: 1,
                    createdAt: 1,
                    owner: '$owner',
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalVideos = await Video.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / Number(limit))
            }
        };

        logger.info(`Fetched videos for user ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'User videos fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getUserVideos: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user videos',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/users/search
 * @description Search users by username, fullName, or bio
 * @access Public
 * @param {string} query - Search query parameter
 * @returns {ApiResponse} List of matching users with pagination
 */
export const searchUsers = async (
    req: Request<{}, {}, {}, SearchQueryParams>,
    res: Response
) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        
        // Validate query
        if (!query || query.trim().length < 2) {
            throw new ApiError(400, 'Search query must be at least 2 characters', []);
        }

        const searchMatch: any = {
            $or: [
                { username: { $regex: query.trim(), $options: 'i' } },
                { fullName: { $regex: query.trim(), $options: 'i' } },
                { bio: { $regex: query.trim(), $options: 'i' } },
            ],
        };

        const users = await User.aggregate([
            { $match: searchMatch },
            { 
                $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    subscribersCount: 1,
                }
            },
            { $sort: { subscribersCount: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalUsers = await User.countDocuments(searchMatch);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalUsers,
                totalPages: Math.ceil(totalUsers / Number(limit))
            }
        };

        logger.info(`Searched users with query "${query}"`);

        return res.status(200).json(
            ApiResponse.success(
                { users, totalUsers },
                'Users found successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in searchUsers: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while searching users',
            error.errors || []
        );
    }
};