import Joi from 'joi';

const authDoorSchema = Joi.number().required();

export default authDoorSchema;
