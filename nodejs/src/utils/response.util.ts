import { Response } from "express";

export const successResponse = (res: Response, data: any) => {
  return res.json({
    success: true,
    data,
  });
};

export const errorResponse = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}; 