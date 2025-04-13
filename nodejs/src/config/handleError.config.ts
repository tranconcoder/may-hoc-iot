export class RequestError {
    private statusCode: number;
    private message: string;

    constructor(statusCode: number, message: string) {
        this.statusCode = statusCode;
        this.message = message;
    }

    public getStatusCode() {
        return this.statusCode;
    }

    public getMessage() {
        return this.message;
    }

    public toString() {
        return `ERROR: ${this.getStatusCode()} ${this.getMessage()}`;
    }

    public getInfo() {
        return {
            code: this.getStatusCode(),
            message: this.getMessage(),
            error: true,
        };
    }
}

export class RequestNotFoundError extends RequestError {
    constructor(message: string) {
        super(404, message);
    }
}

export class RequestPayloadInvalidError extends RequestError {
    constructor(message: string) {
        super(422, message);
    }
}

export class RequestForbiddenError extends RequestError  {
    constructor(message: string) {
        super(403, message)
    }
}
