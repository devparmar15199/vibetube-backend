import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: './.env'});

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
            return null;
        }

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType,
            ...options,
        });

        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
};