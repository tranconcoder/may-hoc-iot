import aes from 'js-crypto-aes';
import type { Request, Response, NextFunction } from 'express';

// Validate
import authDoorSchema from '../config/joiSchema/authDoor.joiSchema';
import SecurityGateServices from '../services/securityGate.service';
import { RequestError } from '../config/handleError.config';
import AESModel from '../config/database/schema/AES.schema';

const iv = '1231231231231231';

export default class SecurityGateController {
	public async authDoor(req: Request, res: Response, next: NextFunction) {
		if (!req.headers['x-api-key']) {
			res.status(401).send('Unauthorized');
			return;
		}
		const keys = await AESModel.findOne({ apiKey: req.headers['x-api-key'] });

		if (!keys) {
			res.status(401).send('Unauthorized');
			return;
		}
		console.log(Buffer.from(req.body.encrypted_data));

		const rfid = await aes
			.decrypt(
				Buffer.from(req.body.encrypted_data),
				Buffer.from(keys.secretKey),
				{
					name: 'AES-CBC',
					iv: Uint8Array.from(Buffer.from(iv, 'ascii')),
				}
			)
			.then((data) => {
				console.log(data);
			})
			.catch(() => {});

		console.log(rfid);

		SecurityGateServices.authDoor(4532356, keys.secretKey).catch(() => {
			throw new RequestError(400, 'Server error!');
		});
	}
}
