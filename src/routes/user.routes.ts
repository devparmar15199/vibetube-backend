import { Router } from 'express';
import { 
    getMyProfile,
    getUserById,
    updateProfile,
    updateAvatar,
    updateCoverImage,
    getMyVideos,
    getUserVideos,
    searchUsers,
    changePassword
} from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { singleAvatar, singleCoverImage } from '../middlewares/multer.middleware';

const router = Router();

// Authenticated user routes
router.get('/me', verifyToken, getMyProfile);
router.patch('/me', verifyToken, updateProfile);
router.post('/change-password', verifyToken, changePassword);
router.patch('/avatar', verifyToken, singleAvatar, updateAvatar);
router.patch('/cover-image', verifyToken, singleCoverImage, updateCoverImage);
router.get('/my-videos', verifyToken, getMyVideos);

// Public user routes
router.get('/search', searchUsers);
router.get('/:id', getUserById);
router.get('/:id/videos', getUserVideos);

export default router;