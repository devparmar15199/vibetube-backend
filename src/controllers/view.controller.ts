import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { View, type IView } from '../models/view.model';
import { ApiResponse, type ApiResponseMeta } from '../utils/apiResponse';
import type { IUser } from '../models/user.model';
import { Video } from '../models/video.model';

interface PaginationParams {
    page?: string;
    limit?: string;
}

/**
 * @route POST /views/:videoId
 * @desc Log a view for a video
 * @access Public
 */
export const logView = async (
    req: Request<{ videoId: string }>,
    res: Response<ApiResponse<{ viewed: boolean } | null>>
) => {
    try {
        const { videoId } = req.params;
        const userId = req.user?._id;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || null;

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const viewKey = userId
            ? { video: videoObjectId, viewer: userId }
            : { video: videoObjectId, ipAddress };

        const existingView = await View.findOne(viewKey);
        if (existingView) {
            return res.status(200).json(
                ApiResponse.success({ viewed: true }, 'View already logged', 200)
            );
        }

        await View.create({
            video: videoObjectId,
            ...(userId && { viewer: userId }),
            ...(ipAddress && { ipAddress }),
            isDeleted: false,
        });

        return res.status(201).json(
            ApiResponse.success(
                { viewed: true }, 
                'View logged successfully',
                201
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while logging view',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};

/**
 * @route GET /views/:videoId
 * @desc Get views for a video
 * @access Private
 */
export const getVideoViews = async (
    req: Request<{ videoId: string }, {}, {}, PaginationParams, { user: IUser }>,
    res: Response<ApiResponse<{ views: IView[]; totalViews: number } | null>>
) => {
    try {
        const user = req.user;
        const { videoId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const videoObjectId = new mongoose.Types.ObjectId(videoId);

        const video = await Video.findById(videoObjectId);
        if (!video || !video.owner.equals(user?._id)) {
            return res.status(404).json(ApiResponse.error(404, null, 'Video not found'));
        }

        const match: any = {
            video: videoObjectId,
            isDeleted: { $ne: true }
        };

        const views = await View.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: 'users',
                    localField: 'viewer',
                    foreignField: '_id',
                    as: 'viewerDetails',
                    pipeline: [{ $project: { username: 1, avatar: 1 } }]
                }
            },
            { $unwind: { path: '$viewerDetails', preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
        ]);

        const totalViews = await View.countDocuments(match);

        const meta: ApiResponseMeta = {
            pagination: {
                current: Number(page),
                pageSize: Number(limit),
                total: totalViews,
                totalPages: Math.ceil(totalViews / Number(limit))
            }
        };

        return res.status(200).json(
            ApiResponse.success(
                { views, totalViews }, 
                'Views fetched successfully',
                200,
                meta
            )
        );
    } catch (error) {
        return res.status(500).json(
            ApiResponse.error(
                500,
                null,
                'Internal Server Error while fetching views',
                error instanceof Error ? [error.message] : []
            )
        );
    }
};