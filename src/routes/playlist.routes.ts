import { Router } from "express";
import {  
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    updatePlaylist,
    deletePlaylist,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    getPublicPlaylists
} from '../controllers/playlist.controller';
import { verifyToken } from "../middlewares/auth.middleware";
import { singleThumbnail } from "../middlewares/multer.middleware";

const router = Router();

// Public routes
router.get('/', getPublicPlaylists);
router.get('/:id', getPlaylistById);

// Private routes
router.use(verifyToken);
router.post('/', singleThumbnail, createPlaylist);
router.get('/user', getUserPlaylists);
router.patch('/:id', singleThumbnail, updatePlaylist);
router.delete('/:id', deletePlaylist);
router.post('/:id/videos/:videoId', addVideoToPlaylist);
router.delete('/:id/videos/:videoId', removeVideoFromPlaylist);

export default router;