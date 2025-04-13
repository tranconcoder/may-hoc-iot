import { ArrayNotEmpty } from "./array";

//
// Face detection
//
export interface HTMLCanvasElementCustom extends HTMLCanvasElement {
    toBuffer: (mimetype?: string) => Buffer;
}

export interface FsTemp {
    writeFileSync: (buffer: Buffer) => string;
}

//
// Face recognition - add face
//
export interface AddFacePayload {
    imgPathList: ArrayNotEmpty<string>;
    label: string;
}
