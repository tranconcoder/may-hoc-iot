import {
	FACE_RECOGNITION_SERVER_HOST,
	FACE_RECOGNITION_SERVER_PORT,
} from '../config/env.config';

export default class UserServices {
	public static async addUser(files: Express.Multer.File[]) {
		const formData = new FormData();

		files.forEach((file) => {
			const blob = new Blob([file.buffer]);

			formData.append('faces[]', blob);
		});

		// Send image files
		const path = `http://${FACE_RECOGNITION_SERVER_HOST}:${FACE_RECOGNITION_SERVER_PORT}/add`;

		const res = await fetch(path, { method: 'POST', body: formData });
		const data = res.text();

		console.log(data);
	}
}
