import type { Request } from 'express';
import multer from 'multer';
import path from 'path';

const getStorage = (folder: 'images' | 'videos') => multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, `./public/${folder}`);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueName + path.extname(file.originalname));
    },
});

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
        allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only images (JPEG, PNG, GIF, WebP) are allowed'));
    }
};

const videoFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /mp4|mov|avi|wmv|flv|webm/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && 
        allowedTypes.test(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only videos (MP4, MOV, AVI, WMV, FLV, WebM) are allowed'));
    }
};

export const uploadImage = multer({ 
    storage: getStorage('images'), 
    fileFilter: imageFilter, 
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

export const uploadVideo = multer({ 
    storage: getStorage('videos'), 
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