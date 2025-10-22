import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Post, type IPost } from '../models/post.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import type { IUser } from '../models/user.model';

interface CreatePostBody {
    content: string;
}

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /posts
 * @desc Create a new post
 * @access Private
 */
export const createPost = async (
    req: Request<{}, {}, CreatePostBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ post: IPost | null } | null>>
) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json(ApiResponse.error(401, null, 'Unauthorized'));

        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json(ApiResponse.error(400, null, 'Post content is required'));
        }

        const post = await Post.create({
            content: content.trim(),
            owner: user._id,
            likesCount: 0,
            commentsCount: 0,
            isDeleted: false,
        });

        // Populate owner
        const populatedPost = await Post.findById(post._id)
            .populate('owner', 'username avatar');

        return res.status(201).json(
            ApiResponse.success(
                { post: populatedPost }, 
                'Post created successfully',
                201
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while creating post',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route PATCH /posts/:id
 * @desc Update a post
 * @access Private
 */
export const updatePost = async (
    req: Request<{ id: string }, {}, CreatePostBody, {}, { user: IUser }>,
    res: Response<ApiResponse<{ post: IPost | null } | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json(ApiResponse.error(400, null, 'Updated content is required'));
        }

        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findByIdAndUpdate(
            {
                _id: postId,
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { content: content.trim() },
            { new: true, runValidators: true }
        ).populate('owner', 'username avatar');

        if (!post) {
            return res.status(404).json(ApiResponse.error(404, null, 'Post not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                { post }, 
                'Post updated successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while updating post',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route DELETE /posts/:id
 * @desc Delete a post
 * @access Private
 */
export const deletePost = async (
    req: Request<{ id: string }, {}, {}, {}, { user: IUser }>,
    res: Response<ApiResponse<{} | null>>
) => {
    try {
        const user = req.user;
        const { id } = req.params;

        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findOneAndUpdate(
            {
                _id: postId,
                owner: user?._id,
                isDeleted: { $ne: true }
            },
            { isDeleted: true, deletedAt: new Date() },
            { new: true }
        );

        if (!post) {
            return res.status(404).json(ApiResponse.error(404, null, 'Post not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                {}, 
                'Post deleted successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while deleting post',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /posts/:id
 * @desc Get post by ID
 * @access Public
 */
export const getPostById = async (
    req: Request<{ id: string }>,
    res: Response<ApiResponse<{ post: IPost | null } | null>>
) => {
    try {
        const { id } = req.params;
        const postId = new mongoose.Types.ObjectId(id);

        const post = await Post.findById(postId)
            .populate('owner', 'username avatar')
            .where({ isDeleted: { $ne: true } });

        if (!post) {
            return res.status(404).json(ApiResponse.error(404, null, 'Post not found'));
        }

        return res.status(200).json(
            ApiResponse.success(
                { post }, 
                'Post fetched successfully',
                200
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching post',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /posts/users/:userId
 * @desc Get user's posts
 * @access Public
 */
export const getUserPosts = async (
    req: Request<{ userId: string }, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ posts: IPost[]; totalPosts: number } | null>>
) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const ownerId = new mongoose.Types.ObjectId(userId);

        const match: any = {
            owner: ownerId,
            isDeleted: { $ne: true }
        };

        const posts = await Post.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, avatar: 1 } }]
                }
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

        return res.status(200).json(
            ApiResponse.success(
                { posts, totalPosts }, 
                'User posts fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching user posts',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /posts
 * @desc Get global feed
 * @access Public
 */
export const getFeed = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response<ApiResponse<{ posts: IPost[]; totalPosts: number } | null>>
) => {
    try {
        const userId = req.user?._id;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const match: any = { isDeleted: { $ne: true } };

        if (userId) {
            // TODO
        }

        const posts = await Post.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [{ $project: { username: 1, avatar: 1 } }]
                }
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

        return res.status(200).json(
            ApiResponse.success(
                { posts, totalPosts }, 
                'Feed fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching feed',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};