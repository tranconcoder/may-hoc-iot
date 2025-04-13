import axios from 'axios';
import { SERVER_HOST, SERVER_PORT } from '../../configs/env.config';

const axiosInstance = axios.create({
	baseURL: `http://${SERVER_HOST}:${SERVER_PORT}/api`,
	timeout: 5_000,
	headers: {
		'Access-Control-Allow-Origin': '*',
	},
});

export default axiosInstance;
