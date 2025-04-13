import { ObjectAnyKey } from "./object";

export interface ConfigFilterVideo extends ObjectAnyKey<string | number, string> {
    fontcolor: string;
    fontfile: string;
    fontsize: number;
    text: string;
    x: number;
    y: number;
}
