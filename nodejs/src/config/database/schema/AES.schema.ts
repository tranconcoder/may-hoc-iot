import { Schema, model, Document } from 'mongoose';

interface IAES extends Document {
	secretKey: Uint8Array;
	apiKey: string;
	createdAt: Date;
}

const AESSchema = new Schema<IAES>({
	secretKey: { type: Array, default: [] },
	apiKey: { type: String, required: true },
	createdAt: { type: Date, default: Date.now, expires: '10m' }, // Document expires after 10 minutes
});

const AESModel = model<IAES>('AES', AESSchema);

export default AESModel;
