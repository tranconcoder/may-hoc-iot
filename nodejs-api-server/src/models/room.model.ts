import { Schema, model, Document } from 'mongoose';

interface IRoom extends Document {
	roomCode: string;
	keyP: number;
	keyG: number;
	createdAt: Date;
}

const roomSchema = new Schema<IRoom>({
	roomCode: { type: String, required: true, unique: true },
	keyP: { type: Schema.Types.Mixed, required: true }, // Mongoose does not support BigInt directly
	keyG: { type: Number, required: true },
	createdAt: { type: Date, default: Date.now, expires: 15 },
});

const Room = model<IRoom>('Room', roomSchema);

// Function to upsert a room
export const upsertRoom = async (
	roomCode: string,
	keyP: BigInt,
	keyG: number
) => {
	try {
		const result = await Room.findOneAndUpdate(
			{ roomCode }, // Filter criteria
			{ keyP, keyG, createdAt: new Date() }, // Update data
			{ upsert: true, new: true, setDefaultsOnInsert: true } // Options
		);
		return result;
	} catch (error) {
		console.error('Error upserting room:', error);
		throw error;
	}
};

export default Room;
