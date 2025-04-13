import type { UnknownObject } from 'express-handlebars/types';

import { readdirSync, existsSync, lstatSync } from 'fs';
import path from 'path';
import { envConfig } from '../config';

const exHbsHelpers: UnknownObject = {
	loadCss(view: string) {
		const viewFileName = view.split('/').at(-1);
		const cssDirPath = path.join(
			__dirname,
			`../../public/css/${viewFileName}`
		);

		let cssTags = '';
		if (existsSync(cssDirPath) && lstatSync(cssDirPath).isDirectory()) {
			const files = readdirSync(cssDirPath);

			files.forEach((file) => {
				if (file.endsWith('.css')) {
					cssTags += `<link rel='stylesheet' href='/public/css/${file}' />\r\n`;
				}
			});
		}

		return cssTags;
	},

	getMediaServerOutputPath() {
		return `${envConfig.MEDIA_SERVER_HOST_IP}:${envConfig.MEDIA_SERVER_OUTPUT_PORT}`;
	},
};

export default exHbsHelpers;
