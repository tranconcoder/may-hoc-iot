import Joi from "joi";

export const getInfoEnvironmentParamSchema = Joi.object({
    year: Joi.number().required().max(new Date().getFullYear()),
    month: Joi.number().min(1).max(12),
    week: Joi.number().min(1).max(53),
    day: Joi.number()
        .min(1)
        .max(31)
        .messages({
            "month.required": "required month when input date",
        })
        .custom((value, helpers) => {
            const { month } = helpers.state.ancestors[0];

            if (!month)
                return helpers.error("any.invalid", {
                    customMessage: "Month is required when input date!",
                });

            return +value;
        }),
});
