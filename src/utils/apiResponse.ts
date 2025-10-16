export class ApiResponse<T = any> {
    public statusCode: number;
    public data: T;
    public message: string;
    public success: boolean;

    constructor(statusCode: number, data: T, message: string = 'Success') {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }

    static success<T = any>(
        data: T,
        message: string = 'Success',
        statusCode: number = 200
    ): ApiResponse<T> {
        return new ApiResponse(statusCode, data, message);
    }

    static error<T = any>(
        statusCode: number,
        data: T = null as T,
        message: string,
        errors: string[] = []
    ): ApiResponse<T> {
        const response = new ApiResponse(statusCode, data, message);
        response.success = false;
        if (errors.length > 0) {
            response.data = { ...data, errors } as T;
        }
        return response;
    }
}