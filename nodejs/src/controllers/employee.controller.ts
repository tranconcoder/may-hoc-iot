import type { Request, Response, NextFunction } from "express";
import type { ArrayNotEmpty } from "../types/array";

// Validator
import addFaceBodyPayload from "../config/joiSchema/addFaceBodyPayload.joiSchema";
import {
    RequestError,
    RequestPayloadInvalidError,
} from "../config/handleError.config";

// Image processing
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 } from "uuid";
import { FRAMESIZE_WIDTH, FRAMESIZE_HEIGHT } from "../config/ffmpeg.config";

// Face Api Js

export default class EmployeeController {
}
