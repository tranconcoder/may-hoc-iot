import Joi from "joi";

const addFaceBodyPayloadSchema = Joi.object({
    label: Joi.string().hex().length(24),
});

export default addFaceBodyPayloadSchema;
