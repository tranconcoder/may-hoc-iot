import type { Response } from 'express';

import _ from 'lodash';

interface SuccessResponseProperties {
    statusCode: number;
    name: string;
    message: string;
    metadata?: Record<string, any>;
    headers?: Record<string, any>;
}
interface EntityResponseConstructorArgs
    extends Partial<Omit<SuccessResponseProperties, 'statusCode'>> {}

export default class SuccessResponse {
    public readonly statusCode: SuccessResponseProperties['statusCode'];
    public readonly name: SuccessResponseProperties['name'];
    public readonly message: SuccessResponseProperties['message'];
    private readonly metadata: SuccessResponseProperties['metadata'];
    private readonly headers: SuccessResponseProperties['headers'];

    public constructor({
        statusCode,
        name,
        message,
        metadata = {},
        headers = {}
    }: SuccessResponseProperties) {
        this.statusCode = statusCode;
        this.name = name;
        this.message = message;
        this.metadata = metadata;
        this.headers = headers;
    }

    public send(
        res: Response,
        headers: SuccessResponseProperties['headers'] = {}
    ): Response {
        // Add headers before send response
        const allHeaders = { ...this.headers, ...headers };
        const keys = Object.keys(allHeaders);

        keys.forEach((key) => {
            res.setHeader(key, allHeaders[key]);
        });

        return res
            .status(this.statusCode)
            .json(_.pick(this, ['statusCode', 'name', 'message', 'metadata']));
    }
}

export class CreatedResponse extends SuccessResponse {
    public constructor({
        name = 'Created',
        message = 'Created success',
        metadata = {},
        headers = {}
    }: EntityResponseConstructorArgs) {
        super({ statusCode: 201, name, message, metadata, headers });
    }
}

export class OkResponse extends SuccessResponse {
    public constructor({
        name = 'Ok',
        message = 'Ok success',
        metadata = {},
        headers = {}
    }: EntityResponseConstructorArgs) {
        super({ statusCode: 200, name, message, metadata, headers });
    }
}

export class NoContentResponse extends SuccessResponse {
    public constructor({
        name = 'NoContent',
        message = 'No content',
        metadata = {},
        headers = {}
    }: EntityResponseConstructorArgs) {
        super({ statusCode: 204, name, message, metadata, headers });
    }
}

export class AcceptedResponse extends SuccessResponse {
    public constructor({
        name = 'Accepted',
        message = 'Accepted',
        metadata = {},
        headers = {}
    }: EntityResponseConstructorArgs) {
        super({ statusCode: 202, name, message, metadata, headers });
    }
}