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
} from '../controllers/user.controller.ts';
import { verifyToken } from '../middlewares/auth.middleware.ts';
import { singleAvatar, singleCoverImage } from '../middlewares/multer.middleware.ts';

const router = Router();

// Get my profile
router.get('/me', verifyToken, getMyProfile);
router.patch('/me', verifyToken, updateProfile);
router.get('/search', searchUsers);
router.post('/change-password', verifyToken, changePassword);
router.patch('/avatar', verifyToken, singleAvatar, updateAvatar);
router.patch('/cover-image', verifyToken, singleCoverImage, updateCoverImage);
router.get('/my-videos', verifyToken, getMyVideos);


router.get('/:id', getUserById);
router.get('/:id/videos', getUserVideos);


export default router;