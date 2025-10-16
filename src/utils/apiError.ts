export class ApiError extends Error {
    public statusCode: number;
    public errors?: string[];
    public details?: Record<string, any>;

    constructor(
        statusCode = 500,
        message = 'Something went wrong!',
        errors: string[] = [],
        details: Record<string, any> = {}
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.details = details; 
    }
}