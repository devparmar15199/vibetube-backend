import { Router } from "express";
import {  
    addComment,
    updateComment,
    deleteComment,
    getComments
} from '../controllers/comment.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get('/:type/:id', getComments);

// Private routes
router.use(verifyToken);
router.post('/:type/:id', addComment);
router.patch('/:commentId', updateComment);
router.delete('/:commentId', deleteComment);

export default router;