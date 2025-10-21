export class ApiError extends Error {
    public statusCode: number;
    public isOperational: boolean;
    public errors?: string[];
    public details?: Record<string, any>;

    constructor(
        statusCode = 500,
        message = 'Something went wrong!',
        errors: string[] = [],
        details: Record<string, any> = {},
        isOperational = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errors = errors;
        this.details = details; 
        this.name = 'ApiError';
    }
}