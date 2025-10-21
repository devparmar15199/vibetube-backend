import { Router } from "express";
import { 
    uploadVideo,
    getAllVideos,
    getVideoById, 
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getUserVideos,
    toggleLike,
    getLikesCount
} from "../controllers/video.controller";
import { videoUpload } from "../middlewares/multer.middleware";
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get('/', getAllVideos);
router.get('/users/:userId/videos', getUserVideos);
router.get('/:videoId/likes', getLikesCount);
router.get('/:videoId', getVideoById);

// Private routes
router.use(verifyToken);
router.post('/', videoUpload, uploadVideo);
router.patch('/:videoId', updateVideo);
router.delete('/:videoId', deleteVideo);
router.post('/:videoId/publish', togglePublishStatus);
router.post('/:videoId/like', toggleLike);

export default router;
