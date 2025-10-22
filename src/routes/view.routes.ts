import { Router } from "express";
import { logView, getVideoViews } from '../controllers/view.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post('/:videoId', logView);

// Private routes
router.get('/:videoId', verifyToken, getVideoViews);

export default router;