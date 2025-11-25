export class ApiError extends Error {
    statusCode: number;
    errors: string[];
    data: null;
    success: boolean;

    constructor(
        statusCode: number,
        message: string = 'Something went wrong',
        errors: string[] = [],
        stack: string = ''
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.data = null; 
        this.success = false;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}