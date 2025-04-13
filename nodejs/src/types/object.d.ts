import type { ObjectType, ObjectTypeDeclaration } from "typescript";

export type ObjectAnyKey<T = any, K = any> = {
    [key in K]: T;
} & Object;
