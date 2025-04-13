import mongoose from "mongoose";

const { Schema } = mongoose;

const faceSchema = new Schema({
    employee_id: {
        type: mongoose.Types.ObjectId,
        required: true,
        unique: true,
    },
    descriptors: {
        type: Array,
        required: true,
    },
});

const FaceModel = mongoose.model("Face", faceSchema);

export default FaceModel
