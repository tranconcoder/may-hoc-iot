import type { Request, Response, NextFunction, RequestHandler } from "express";

export const catchError = (
    cb: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
    return (req, res, next) => {
        cb(req, res, next).catch(next);
    };
};
