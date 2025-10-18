import type { Request, Response } from 'express';
import { User, IUser } from '../models/user.model.ts';
import { IVideo, Video } from '../models/video.model.ts';
import { uploadToCloudinary } from '../utils/cloudinarySetup.ts';
import { ApiResponse } from '../utils/apiResponse.ts';

interface UpdateProfileBody {
    fullName?: string;
    bio?: string;
}

interface ChangePasswordBody {
    currentPassword: string;
    newPassword: string;
}

interface SearchQuery {
    query: string;
}

/**
 * @route GET /users/me
 * @desc Get the profile of the authenticated user
 * @access Private
 */
export const getMyProfile = async (
    req: Request,
    res: Response<ApiResponse<IUser | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }

        return res.status(200).json(
            ApiResponse.success(user, 'Profile fetched successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while fetching user profile',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /users/:id
 * @desc Get the user by ID
 * @access Public
 */
export const getUserById = async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<IUser | null>>
) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).select('-password -refreshToken -watchHistory');
        if (!user) {
            return res.status(404).json(
                ApiResponse.error(404, null, 'User not found')
            );
        }
        
        return res.status(200).json(
            ApiResponse.success(user, 'User fetched successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while fetching user by ID',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /users/me
 * @desc Update the profile of the authenticated user
 * @access Private
 */
export const updateProfile = async (
    req: Request<{}, {}, UpdateProfileBody>,
    res: Response<ApiResponse<IUser | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }

        const { fullName, bio } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { fullName, bio },
            { new: true, runValidators: true }
        ).select('-password -refreshToken');

        return res.status(200).json(
            ApiResponse.success(updatedUser, 'Profile updated successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while updating profile',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route POST /users/change-password
 * @desc Change the password of the authenticated user
 * @access Private
 */
export const changePassword = async (
    req: Request<{}, {}, ChangePasswordBody>,
    res: Response<ApiResponse<null>>
) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Current password and new password are required')
            );
        }

        const user = await User.findById(req.user?._id).select('+password');
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Current password is incorrect')
            );
        }

        if (newPassword.length < 8) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'New password must be at least 8 characters long')
            );
        }
        user.password = newPassword;
        await user.save({ validateBeforeSave: false });

        return res.status(200).json(
            ApiResponse.success(null, 'Password changed successfully', 200)
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while updating password',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /users/avatar
 * @desc Update the avatar of the authenticated user
 * @access Private
 */
export const updateAvatar = async (
    req: Request,
    res: Response<ApiResponse<{ avatar: string } | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json(ApiResponse.error(400, null, 'Avatar file is required'));
        }

        const avatar = await uploadToCloudinary(file.path, 'image');
        if (!avatar?.secure_url) {
            return res.status(500).json(
                ApiResponse.error(
                    500, 
                    null, 
                    'Failed to upload avatar'
                )
            );
        }

        await User.findByIdAndUpdate(
            user._id,
            { avatar: avatar.secure_url },
            { new: true }
        );

        return res.status(200).json(
            ApiResponse.success(
                { avatar: avatar.secure_url },
                'Avatar updated successfully', 
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while updating avatar',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /users/cover-image
 * @desc Update the cover image of the authenticated user
 * @access Private
 */
export const updateCoverImage = async (
    req: Request,
    res: Response<ApiResponse<{ coverImage: string } | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json(ApiResponse.error(400, null, 'Cover image file is required'));
        }

        const coverImage = await uploadToCloudinary(file.path, 'image');
        if (!coverImage?.secure_url) {
            return res.status(500).json(
                ApiResponse.error(
                    500, 
                    null, 
                    'Failed to upload cover image'
                )
            );
        }

        await User.findByIdAndUpdate(
            user._id,
            { coverImage: coverImage.secure_url }
        );

        return res.status(200).json(
            ApiResponse.success(
                { coverImage: coverImage.secure_url },
                'Cover image updated successfully', 
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500, 
                null, 
                'Internal Server Error while updating cover image',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /users/videos
 * @desc Get videos uploaded by the authenticated user
 * @access Private
 */
export const getMyVideos = async (
    req: Request,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));
        }

        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const videos = await Video.aggregate([
            { $match: { owner: user._id, isPublished: true } },
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
                    owner: '$owner'
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalVideos = await Video.countDocuments({
            owner: user._id,
            isPublished: true
        });

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'Videos fetched successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching videos',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /users/:id/videos
 * @desc Get videos uploaded by a specific user
 * @access Public
 */
export const getUserVideos = async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<{ videos: IVideo[]; totalVideos: number } | null>>
) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const videos = await Video.aggregate([
            { $match: { owner: new User({ id }), isPublished: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { fullName: 1, username: 1 } }]
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
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalVideos = await Video.countDocuments({
            owner: id,
            isPublished: true
        });

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'User videos fetched successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching user videos',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /users/search
 * @desc Search users by query
 * @access Public
 */
export const searchUsers = async (
    req: Request<{}, {}, SearchQuery>,
    res: Response<ApiResponse<{ users: IUser[]; totalUsers: number } | null>>
) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        
        if (!query) {
            return res.status(400).json(
                ApiResponse.error(400, null, 'Search query must be at least 2 characters')
            );
        }

        const users = await User.aggregate([
            { 
                $match: {
                    $or: [
                        { username: { $regex: query, $options: 'i' } },
                        { fullName: { $regex: query, $options: 'i' } },
                        { email: { $regex: query, $options: 'i' } },
                    ]
                } 
            },
            { 
                $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                    subscribersCount: 1
                }
            },
            { $sort: { subscribersCount: -1 } },
            { $skip: skip },
            { $limit: Number(limit) }
        ]);

        const totalUsers = await User.countDocuments({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { fullName: { $regex: query, $options: 'i' } },
            ]
        });

        return res.status(200).json(
            ApiResponse.success(
                { users, totalUsers },
                'Users found successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while searching users',
                error instanceof Error ? [error.message] : []
            )
        );
    }
}