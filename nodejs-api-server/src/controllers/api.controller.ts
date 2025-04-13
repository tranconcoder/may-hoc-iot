import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import RoomModel, { upsertRoom } from '../models/room.model';

// Function to hash the address list
const hash = (algorithm: string, data: string) => {
	return crypto.createHash(algorithm).update(data).digest('hex');
};

export class ApiController {
	static async createOrUpdateRoom(
		req: Request,
		res: Response,
		next: NextFunction
	) {
		try {
			const { addressList } = req.body;

			// Sort the address list and hash it
			const sortedAddressList = addressList.sort();
			const hashedAddress = hash('sha256', sortedAddressList.join(''));

			// Check if the room already exists
			let room = await RoomModel.findOne({ roomCode: hashedAddress });

			if (room) {
				// Room already exists, return the existing room information
				return res.status(200).json({ message: 'Room already exists', room });
			}

			// Generate keyP and keyG (public keys for AES)
			const keyP = BigInt(Math.floor(Math.random() * 10000000000));
			const keyG = Math.floor(Math.random() * 1000000);

			// Upsert the room record
			room = await upsertRoom(hashedAddress, keyP, keyG);

			console.log(room);

			res.status(201).json({ message: 'Room created successfully', room });
		} catch (error) {
			next(error);
		}
	}
}
