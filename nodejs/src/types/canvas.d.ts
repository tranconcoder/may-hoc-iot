import { HTMLCanvasElementCustom } from "./worker";
import * as canvas from "canvas";

type CanvasType = typeof canvas;

interface CanvasCustom extends CanvasType {
    loadImage: (path: string) => Promise<HTMLImageElement>;
    createCanvas: (width: number, height: number) => HTMLCanvasElementCustom;
}
