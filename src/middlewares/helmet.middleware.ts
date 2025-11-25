import helmet from 'helmet';
import { config } from '../config';

export default helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'res.cloudinary.com'],
            connectSrc: ["'self'", config.frontendUrl, config.redis.url],
        },
    },
    xssFilter: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});