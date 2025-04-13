import type { ErrorRequestHandler } from 'express';

import { RequestError } from '../config/handleError.config';
import colors from 'colors';

export default (function handleError(
	error: RequestError | Error,
	req,
	res,
	next
) {
	if (error instanceof Error) error = new RequestError(400, error.message);
	if (!(error instanceof RequestError))
		error = new RequestError(400, 'Unknown error!');

	console.error(colors.red(error.toString()));
	res.status(error.getStatusCode()).json(error.getInfo());
} as ErrorRequestHandler);
