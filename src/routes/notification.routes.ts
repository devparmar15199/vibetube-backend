import { Router } from "express";
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../controllers/notification.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Private routes
router.use(verifyToken);
router.get('/', getNotifications);
router.post('/:id/read', markAsRead);
router.patch('/all/read', markAllAsRead);
router.delete('/:id', deleteNotification);

export default router;