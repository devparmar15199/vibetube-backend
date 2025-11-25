import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import { config } from '../config';
import logger from './logger';

cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
});

export const uploadToCloudinary = async (
    localFilePath: string,
    resourceType: 'image' | 'video' | 'auto' = 'auto',
    options: any = {}
): Promise<UploadApiResponse | null> => {
    try {
        if (!localFilePath || !fs.existsSync(localFilePath)) {
            logger.warn(`File path does not exist: ${localFilePath}`);
            return null;
        }

        const response: UploadApiResponse = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType,
            ...options,
        });
        
        // Clean up local file safely
        fs.unlink(localFilePath, (err) => {
            if (err) logger.error(`Failed to delete local file ${localFilePath}: ${err.message}`);
        });
        return response;
    } catch (error: any) {
        logger.error(`Cloudinary upload error: ${error.message}`);
        // Clean up on error
        if (fs.existsSync(localFilePath)) {
            fs.unlink(localFilePath, (err) => {
                if (err) logger.error(`Failed to delete local file on error ${localFilePath}: ${error.message}`);
            });
        }
        return null;
    }
};