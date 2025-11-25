import type { Request } from 'express';
import multer from 'multer';
import path from 'path';
import logger from '../utils/logger';

const getStorage = (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    let folder: string;
    if (file.fieldname === 'videoFile') {
        folder = 'videos';
    } else if (file.fieldname === 'thumbnail') {
        folder = 'images';
    } else {
        return cb(new Error('Invalid field name'), '');
    }
    cb(null, `/public/${folder}`);
};

const combinedFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.fieldname === 'videoFile') {
        videoFilter(req, file, cb);
    } else if (file.fieldname === 'thumbnail') {
        imageFilter(req, file, cb);
    } else {
        return cb(new Error('Unexpected field'));
    }
};

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
        allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn(`Invalid image file type: ${file.originalname}`);
        cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'));
    }
};

const videoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /mp4|mov|avi|wmv|flv|webm/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
        allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        logger.warn(`Invalid video file type: ${file.originalname}`);
        cb(new Error('Only videos (MP4, MOV, AVI, WMV, FLV, WebM) are allowed'));
    }
};

export const uploadVideoAndThumbnail = multer({
    storage: multer.diskStorage({
        destination: getStorage,
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueName + path.extname(file.originalname));
        },
    }),
    fileFilter: combinedFileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
}).fields([
    { name: 'videoFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]);

export const uploadImage = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'public/images'),
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueName + path.extname(file.originalname));
        },
    }), 
    fileFilter: imageFilter, 
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

export const uploadVideo = multer({ 
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'public/videos'),
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueName + path.extname(file.originalname));
        },
    }), 
    fileFilter: videoFilter, 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

export const authUpload = uploadImage.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]);

export const singleAvatar = uploadImage.single('avatar');
export const singleCoverImage = uploadImage.single('coverImage');
export const singleVideo = uploadVideo.single('videoFile');
export const singleThumbnail = uploadImage.single('thumbnail');