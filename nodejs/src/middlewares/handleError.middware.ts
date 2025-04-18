import type { Request, Response, NextFunction, RequestHandler } from "express";

export const catchError = (
    cb: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler => {
    return async (req, res, next) => {
        try {
            await cb(req, res, next)
        } catch (error) {
            next(error)
        }
    };
};
