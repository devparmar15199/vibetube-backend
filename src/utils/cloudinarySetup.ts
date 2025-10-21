import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

if (!process.env.NODE_ENV) {
    dotenv.config({ path: './.env' });
}

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
    localFilePath: string,
    resourceType: 'image' | 'video' | 'auto' = 'auto',
    options: any = {}
): Promise<UploadApiResponse | null> => {
    try {
        if (!localFilePath || !fs.existsSync(localFilePath)) {
            console.warn('File path does not exist:', localFilePath);
            return null;
        }

        const response: UploadApiResponse = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType,
            ...options,
        });
        
        // Clean up local file safely
        fs.unlink(localFilePath, (err) => {
            if (err) console.error('Failed to delete local file:', err);
        });
        return response;
    } catch (error: any) {
        console.error('Cloudinary upload error:', error);
        // Clean up on error
        if (fs.existsSync(localFilePath)) {
            fs.unlink(localFilePath, (err) => {
                if (err) console.error('Failed to delete local file on error:', err);
            });
        }
        return null;
    }
};