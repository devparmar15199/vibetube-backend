import { Router } from 'express';
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshToken
} from '../controllers/auth.controller.ts';
import { verifyToken } from '../middlewares/auth.middleware.ts';
import { authUpload } from '../middlewares/multer.middleware.ts';

const router = Router();

// Register a new user
router.post('/register', authUpload, registerUser);

// Login user
router.post('/login', loginUser);

// Logout user
router.post('/logout', verifyToken, logoutUser);

// Refresh token
router.post('/refresh-token', refreshToken);

export default router;