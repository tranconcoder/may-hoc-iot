import type { Request, Response, NextFunction } from 'express';

export default class AuthController {
	static async handleLogin(req: Request, res: Response, next: NextFunction) {
		const { email, password } = req.body;

		res.json({ email, password });
	}
}
