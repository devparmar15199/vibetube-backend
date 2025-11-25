// import BullMQ from 'bullmq';
// const { Queue } = BullMQ;
// import { config } from '../config';
// import logger from '../utils/logger';
// import { Video, type IVideo } from '../models/video.model';
// import { Tag } from '../models/tag.model';
// import { uploadToCloudinary } from '../utils/cloudinarySetup';
// import { ApiError } from '../utils/apiError';

// // Define job data interface
// interface VideoProcessorJob {
//     videoId: string;
//     localVideoPath: string;
//     localThumbnailPath?: string;
// }

// // Initialize queue
// export const videoProcessorQueue = new Queue<VideoProcessorJob>('videoProcessor', {
//     connection: {
//         host: new URL(config.redis.url).hostname,
//         port: parseInt(new URL(config.redis.url).port || '6379', 10),
//         maxRetriesPerRequest: 5,
//     },
//     defaultJobOptions: {
//         attempts: 3,
//         backoff: {
//             type: 'exponential',
//             delay: 1000,
//         },
//     },
// });

// // Process video job
// export const processVideo = async (job: { data: VideoProcessorJob }) => {
//     const { videoId, localVideoPath, localThumbnailPath } = job.data;
//     try {
//         logger.info(`Processing video job for videoId: ${videoId}`);

//         // Upload video to Cloudinary
//         const videoUpload = await uploadToCloudinary(localVideoPath, 'video', {
//             folder: 'videos',
//             transformation: [
//                 { quality: 'auto', fetch_format: 'auto' },  // Optimize video
//             ],
//         });

//         if (!videoUpload) {
//             throw new ApiError(500, 'Failed to upload video to Cloudinary');
//         }

//         // Update video document
//         const updateData: Partial<IVideo> = {
//             videoFile: videoUpload.secure_url,
//             duration: Math.round(videoUpload.duration || 0),
//         };

//         // Upload thumbnail if provided
//         if (localThumbnailPath) {
//             const thumbnailUpload = await uploadToCloudinary(localThumbnailPath, 'image', {
//                 folder: 'thumbnails',
//                 transformation: [
//                     { width: 1280, height: 720, crop: 'fill' }, // Standard thumbnail size
//                 ],
//             });

//             if (!thumbnailUpload) {
//                 throw new ApiError(500, 'Failed to upload thumbnail to Cloudinary');
//             }

//             updateData.thumbnail = thumbnailUpload.secure_url;
//         }

//         // Update video in database
//         const video = await Video.findByIdAndUpdate(
//             videoId,
//             { $set: updateData },
//             { new: true }
//         );

//         if (!video) {
//             throw new ApiError(404, 'Video not found');
//         }

//         // Update tag usage counts
//         if (video.tags && video.tags.length > 0) {
//             for (const tagId of video.tags) {
//                 await Tag.findByIdAndUpdate(tagId, { $inc: { usageCount: 1 } });
//             }
//             logger.info(`Updated usage counts for ${video.tags.length} tags for video ${videoId}`);
//         }

//         logger.info(`Video processed successfully: ${videoId}`);
//     } catch (error: any) {
//         logger.error(`Video processing failed for ${videoId}: ${error.message}`);
//         throw error;
//     }
// };

// // Add job to queue
// export const addVideoProcessingJob = async (
//     videoId: string,
//     localVideoPath: string,
//     localThumbnailPath: string
// ) => {
//     try {
//         await videoProcessorQueue.add('processVideo', {
//             videoId,
//             localVideoPath,
//             localThumbnailPath,
//         });
//         logger.info(`Added video processing job for videoId: ${videoId}`);
//     } catch (error: any) {
//         logger.error(`Failed to add video processing job: ${error.message}`);
//         throw new ApiError(500, 'Failed to queue video processing');
//     }
// };