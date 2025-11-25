import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { healthCheck } from '../controllers/health.controller';

const router = Router();

/**
 * @route GET /api/v1/health
 * @description Check the health status of the API (MongoDB, Redis, etc.)
 * @access Public
 * @returns {ApiResponse} Health status of services
 */
router.get('/', asyncHandler(healthCheck));

export default router;