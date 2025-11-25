import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyToken } from '../middlewares/auth.middleware';
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

const router = Router();

/**
 * @route GET /api/v1/subscriptions/users/:userId/subscribers
 * @description Get subscribers of a channel
 * @access Public
 * @param {string} userId - Channel (user) ID
 * @returns {ApiResponse} List of subscribers with pagination
 */
router.get('/users/:userId/subscribers', asyncHandler(getChannelSubscribers));

/**
 * @route GET /api/v1/subscriptions/users/:userId/subscribers/count
 * @description Get subscriber count for a channel
 * @access Public
 * @param {string} userId - Channel (user) ID
 * @returns {ApiResponse} Subscriber count
 */
router.get('/users/:userId/subscribers/count', asyncHandler(getSubscriberCount));

/**
 * @route POST /api/v1/subscriptions
 * @description Subscribe to a channel
 * @access Private (requires authentication)
 * @param {Object} body - Channel ID to subscribe to
 * @returns {ApiResponse} Subscription details
 */
router.post('/', verifyToken, asyncHandler(subscribe));

/**
 * @route DELETE /api/v1/subscriptions/:channelId
 * @description Unsubscribe from a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID to unsubscribe from
 * @returns {ApiResponse} Success message
 */
router.delete('/:channelId', verifyToken, asyncHandler(unsubscribe));

/**
 * @route POST /api/v1/subscriptions/toggle/:channelId
 * @description Toggle subscription status for a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID
 * @returns {ApiResponse} Subscription status
 */
router.post('/toggle/:channelId', verifyToken, asyncHandler(toggleSubscription));

/**
 * @route GET /api/v1/subscriptions
 * @description Get the authenticated user's subscriptions
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of subscribed channels with pagination
 */
router.get('/', verifyToken, asyncHandler(getMySubscriptions));

/**
 * @route GET /api/v1/subscriptions/is-subscribed/:channelId
 * @description Check if the authenticated user is subscribed to a channel
 * @access Private (requires authentication)
 * @param {string} channelId - Channel ID
 * @returns {ApiResponse} Boolean indicating subscription status
 */
router.get('/is-subscribed/:channelId', verifyToken, asyncHandler(isSubscribed));

/**
 * @route GET /api/v1/subscriptions/feed
 * @description Get video feed from subscribed channels
 * @access Private (requires authentication)
 * @returns {ApiResponse} List of videos from subscribed channels with pagination
 */
router.get('/feed', verifyToken, asyncHandler(getSubscriptionFeed));

export default router;