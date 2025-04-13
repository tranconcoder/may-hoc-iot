import multer, { memoryStorage, Options } from "multer";
import { RequestPayloadInvalidError } from "./handleError.config";

const imageFileFilter: Options["fileFilter"] = (_, file, callback) => {
    const mimeTypeList = ["image/jpeg", "image/jpg", "image/png"];
    if (!mimeTypeList.includes(file.mimetype)) {
        callback(
            new RequestPayloadInvalidError("Mimetype not support!") as any,
            false
        );
        return;
    }

    callback(null, true);
};

const faceStorage = memoryStorage();

export const uploadFace = multer({
    storage: faceStorage,
    limits: {
        fileSize: 10 * 1024 ** 2, // 10Mb
    },
    fileFilter: imageFileFilter,
});

export const uploadNewFaces = multer({
    storage: memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 10 * 1024 ** 2, // 10Mb
        files: 30,
    },
});
