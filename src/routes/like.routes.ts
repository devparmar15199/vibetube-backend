import { Router } from "express";
import {  
    toggleLike,
    getLikesCount,
    getLikedByUser,
    isLiked
} from '../controllers/like.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get('/:type/:id/count', getLikesCount);

// Private routes
router.use(verifyToken);
router.post('/:type/:id', toggleLike);
router.get('/:type/:id/is-liked', isLiked);
router.get('/user', getLikedByUser);

export default router;