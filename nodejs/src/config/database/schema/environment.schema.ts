import mongoose from "mongoose";

const { Schema } = mongoose;

const environmentSchema = new Schema(
    {
        temp: {
            type: Number,
            required: true,
        },
        humidity: {
            type: Number,
            required: true,
        },
    },
    {
        timestamps: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    }
);

export const EnvironmentModel = mongoose.model(
    "Environment",
    environmentSchema
);
