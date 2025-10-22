import { Router } from "express";
import {
    createPost,
    updatePost,
    deletePost,
    getUserPosts,
    getPostById,
    getFeed
} from '../controllers/post.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get('/', getFeed);
router.get('/:id', getPostById);
router.get('/users/:userId', getUserPosts);

// Private routes
router.use(verifyToken);
router.post('/', createPost);
router.patch('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;