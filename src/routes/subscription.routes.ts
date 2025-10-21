import { Router } from "express";
import { 
    subscribe, 
    unsubscribe, 
    getMySubscriptions, 
    getChannelSubscribers, 
    getSubscriberCount, 
    isSubscribed, 
    getSubscriptionFeed,
    toggleSubscription
} from '../controllers/subscription.controller';
import { verifyToken } from "../middlewares/auth.middleware";

const router = Router();

// Protected routes
router.post('/', verifyToken, subscribe);
router.delete('/:channelId', verifyToken, unsubscribe);
router.get('/', verifyToken, getMySubscriptions);
router.post('/toggle/:channelId', verifyToken, toggleSubscription);
router.get('/is-subscribed/:channelId', verifyToken, isSubscribed);
router.get('/feed', verifyToken, getSubscriptionFeed);

// Public routes
router.get('/users/:userId/subscribers', getChannelSubscribers);
router.get('/users/:userId/subscribers/count', getSubscriberCount);

export default router;