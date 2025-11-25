import cors from 'cors';
import { config } from '../config';

const corsOptions: cors.CorsOptions = {
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

export default cors(corsOptions);