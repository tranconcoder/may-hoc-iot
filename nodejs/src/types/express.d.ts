import type { Request } from "express";
import * as stream from "stream";

export interface FlvRequest extends Request {
    ffmpegPipe: stream.PassThrough | stream.Writable;
}
