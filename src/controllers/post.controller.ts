import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Post } from '../models/post.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface CreatePostBody {
    content: string;
}

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /api/v1/posts
 * @description Create a new post
 * @access Private (requires authentication)
 * @param {Object} body - Post data (content)
 * @returns {ApiResponse} Created post
 */
export const createPost = async (
    req: Request<{}, {}, CreatePostBody>,
    res: Response
) => {
    try {
const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { content } = req.body;

        // Validation is handled by middleware, but double-check content
        if (!content?.trim()) {
            throw new ApiError(400, 'Post content is required', []);
        }

        const post = await Post.create({
            content: content.trim(),
            owner: user._id,
            likesCount: 0,
            commentsCount: 0,
        });

        // Populate owner
        const populatedPost = await Post.findById(post._id)
            .populate('owner', 'username avatar fullName');
            
        logger.info(`Post ${post._id} created by user ${user._id}`);

        return res.status(201).json(
            ApiResponse.success(
                { post: populatedPost },
                'Post created successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in createPost: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while creating post',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/posts/:id
 * @description Update a post's content
 * @access Private (requires authentication)
 * @param {string} id - Post ID
 * @param {Object} body - Updated post data (content)
 * @returns {ApiResponse} Updated post
 */
export const updatePost = async (
    req: Request<{ id: string }, {}, CreatePostBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;
        const { content } = req.body;

        // Validation is handled by middleware, but double-check content
        if (!content?.trim()) {
            throw new ApiError(400, 'Updated content is required', []);
        }

        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid post ID', []);
        }

        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findOneAndUpdate(
            {
                _id: postId,
                owner: user._id,
            },
            { content: content.trim() },
            { new: true, runValidators: true }
        ).populate('owner', 'username avatar fullName');
        
        if (!post) {
            throw new ApiError(404, 'Post not found or you do not own it', []);
        }

        logger.info(`Post ${id} updated by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { post },
                'Post updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updatePost: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating post',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/posts/:id
 * @description Delete a post
 * @access Private (requires authentication)
 * @param {string} id - Post ID
 * @returns {ApiResponse} Success message
 */
export const deletePost = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;

        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid post ID', []);
        }

        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findOneAndDelete({
            _id: postId,
            owner: user._id,
        });

        if (!post) {
            throw new ApiError(404, 'Post not found or you do not own it', []);
        }

        logger.info(`Post ${id} deleted by user ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Post deleted successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in deletePost: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting post',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/posts/:id
 * @description Get a specific post by ID
 * @access Public
 * @param {string} id - Post ID
 * @returns {ApiResponse} Post details
 */
export const getPostById = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const { id } = req.params;

        // Validate post ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid post ID', []);
        }

        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findById(postId)
            .populate('owner', 'username avatar fullName')
            .lean();

        if (!post) {
            throw new ApiError(404, 'Post not found', []);
        }

        logger.info(`Fetched post ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { post },
                'Post fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getPostById: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching post',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/posts/users/:userId
 * @description Get posts by a specific user
 * @access Public
 * @param {string} userId - User ID
 * @returns {ApiResponse} List of user's posts with pagination
 */
export const getUserPosts = async (
    req: Request<{ userId: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError(400, 'Invalid user ID', []);
        }

        const ownerId = new mongoose.Types.ObjectId(userId);

        const match: any = { owner: ownerId };

        const posts = await Post.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, avatar: 1, fullName: 1 } }],
                },
            },
            { $unwind: '$owner' },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
        ]);

        const totalPosts = await Post.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalPosts,
                totalPages: Math.ceil(totalPosts / Number(limit))
            }
        };

        logger.info(`Fetched posts for user ${userId}`);

        return res.status(200).json(
            ApiResponse.success(
                { posts, totalPosts },
                'User posts fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getUserPosts: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching user posts',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/posts
 * @description Get the social feed of posts
 * @access Public
 * @returns {ApiResponse} List of posts with pagination
 */
export const getFeed = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const user = req.user?._id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = {};

        const posts = await Post.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [
                        { $project: { username: 1, avatar: 1, fullName: 1 } },
                        { $sort: { followersCount: -1 } },
                    ],
                },
            },
            { $unwind: '$owner' },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
        ]);

        const totalPosts = await Post.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalPosts,
                totalPages: Math.ceil(totalPosts / Number(limit))
            }
        };

        logger.info(`Fetched feed for user ${user || 'anonymous'}`);

        return res.status(200).json(
            ApiResponse.success(
                { posts, totalPosts },
                'Feed fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getFeed: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching feed',
            error.errors || []
        );
    }
};