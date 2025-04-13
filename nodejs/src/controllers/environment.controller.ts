import type { Request, Response, NextFunction } from "express";
import type { Date } from "../types/date";

import { getInfoEnvironmentParamSchema } from "../config/joiSchema/getInfoEnvironment.joiSchema";
import EnvironmentServices from "../services/environment.service";

export class EnvironmentController {
    public static async getInfo(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        const date: Date = await getInfoEnvironmentParamSchema.validateAsync(
            req.query
        );

        res.status(200).json(await EnvironmentServices.getInfo(date));
    }

    public static async getCurrentInfo(req: Request, res: Response, next: NextFunction) {
        res.status(200).json(await EnvironmentServices.getCurrentInfo())
    }
}
