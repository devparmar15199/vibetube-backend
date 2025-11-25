import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Tag } from '../models/tag.model';
import { Video } from '../models/video.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import logger from '../utils/logger';

interface CreateTagBody {
    name: string;
}

interface PaginationParams {
    page?: number;
    limit?: number;
}

/**
 * @route POST /api/v1/tags
 * @description Create a new tag (admin only)
 * @access Private (requires authentication)
 * @param {Object} body - Tag data (name)
 * @returns {ApiResponse} Created tag
 */
export const createTag = async (
    req: Request<{}, {}, CreateTagBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { name } = req.body;

        if (!name?.trim()) {
            throw new ApiError(400, 'Tag name is required', []);
        }

        // Check for existing tag (case-insensitive)
        const existingTag = await Tag.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
        if (existingTag) {
            throw new ApiError(400, 'Tag already exists', []);
        }

        const tag = await Tag.create({
            name: name.trim(),
        });

        logger.info(`Tag ${tag._id} created by admin ${user._id}`);

        return res.status(201).json(
            ApiResponse.success(
                { tag },
                'Tag created successfully',
                201
            )
        );
    } catch (error: any) {
        logger.error(`Error in createTag: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while creating tag',
            error.errors || []
        );
    }
};

/**
 * @route PATCH /api/v1/tags/:id
 * @description Update a tag's name (admin only)
 * @access Private (requires authentication)
 * @param {string} id - Tag ID
 * @param {Object} body - Updated tag data (name)
 * @returns {ApiResponse} Updated tag
 */
export const updateTag = async (
    req: Request<{ id: string }, {}, CreateTagBody>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;
        const { name } = req.body;

        // Validate tag ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid tag ID', []);
        }

        if (!name?.trim()) {
            throw new ApiError(400, 'Tag name is required', []);
        }

        const tagId = new mongoose.Types.ObjectId(id);

        // Check for existing tag with the new name (case-insensitive)
        const existingTag = await Tag.findOne({
            name: { $regex: `^${name.trim()}$`, $options: 'i' },
            _id: { $ne: tagId },
        });
        if (existingTag) {
            throw new ApiError(400, 'Tag name already exists', []);
        }

        const tag = await Tag.findByIdAndUpdate(
            tagId,
            { name: name.trim() },
            { new: true, runValidators: true }
        );

        if (!tag) {
            throw new ApiError(404, 'Tag not found', []);
        }

        logger.info(`Tag ${id} updated by admin ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                { tag },
                'Tag updated successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in updateTag: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while updating tag',
            error.errors || []
        );
    }
};

/**
 * @route DELETE /api/v1/tags/:id
 * @description Delete a tag (admin only)
 * @access Private (requires authentication)
 * @param {string} id - Tag ID
 * @returns {ApiResponse} Success message
 */
export const deleteTag = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const user = req.user;
        if (!user) {
            throw new ApiError(401, 'Unauthorized', []);
        }

        const { id } = req.params;

        // Validate tag ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid tag ID', []);
        }

        const tagId = new mongoose.Types.ObjectId(id);

        // Delete tag and remove it from videos
        const tag = await Tag.findByIdAndDelete(tagId);
        if (!tag) {
            throw new ApiError(404, 'Tag not found', []);
        }

        // Remove tag from all videos
        await Video.updateMany(
            { tags: tagId },
            { $pull: { tags: tagId } }
        );

        logger.info(`Tag ${id} deleted by admin ${user._id}`);

        return res.status(200).json(
            ApiResponse.success(
                {},
                'Tag deleted successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in deleteTag: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while deleting tag',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/tags
 * @description Get all tags with optional pagination
 * @access Public
 * @returns {ApiResponse} List of tags with pagination
 */
export const getTags = async (
    req: Request<{}, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const tags = await Tag.find()
            .sort({ name: 1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const totalTags = await Tag.countDocuments();

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalTags,
                totalPages: Math.ceil(totalTags / Number(limit)),
            },
        };

        logger.info(`Fetched tags with page ${Number(page)} and limit ${Number(limit)}`);

        return res.status(200).json(
            ApiResponse.success(
                { tags, totalTags },
                'Tags fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getTags: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching tags',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/tags/:id
 * @description Get a specific tag by ID
 * @access Public
 * @param {string} id - Tag ID
 * @returns {ApiResponse} Tag details
 */
export const getTagById = async (
    req: Request<{ id: string }>,
    res: Response
) => {
    try {
        const { id } = req.params;

        // Validate tag ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid tag ID', []);
        }

        const tagId = new mongoose.Types.ObjectId(id);

        const tag = await Tag.findById(tagId).lean();

        if (!tag) {
            throw new ApiError(404, 'Tag not found', []);
        }

        logger.info(`Fetched tag ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { tag },
                'Tag fetched successfully',
                200
            )
        );
    } catch (error: any) {
        logger.error(`Error in getTagById: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching tag',
            error.errors || []
        );
    }
};

/**
 * @route GET /api/v1/tags/:id/videos
 * @description Get videos associated with a specific tag
 * @access Public
 * @param {string} id - Tag ID
 * @returns {ApiResponse} List of videos with pagination
 */
export const getVideosByTag = async (
    req: Request<{ id: string }, {}, {}, PaginationParams>,
    res: Response
) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Validate tag ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, 'Invalid tag ID', []);
        }

        const tagId = new mongoose.Types.ObjectId(id);

        // Check if tag exists
        const tag = await Tag.findById(tagId);
        if (!tag) {
            throw new ApiError(404, 'Tag not found', []);
        }

        const videos = await Video.aggregate([
            { $match: { tags: tagId, isPublished: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'owner',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar: 1 } },
                    ],
                },
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
                    owner: 1,
                },
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
        ]);

        const totalVideos = await Video.countDocuments({ tags: tagId, isPublished: true });

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalVideos,
                totalPages: Math.ceil(totalVideos / Number(limit)),
            },
        };

        logger.info(`Fetched videos for tag ${id}`);

        return res.status(200).json(
            ApiResponse.success(
                { videos, totalVideos },
                'Videos fetched successfully',
                200,
                meta
            )
        );
    } catch (error: any) {
        logger.error(`Error in getVideosByTag: ${error.message}`);
        throw new ApiError(
            error.statusCode || 500,
            error.message || 'Internal Server Error while fetching videos by tag',
            error.errors || []
        );
    }
};