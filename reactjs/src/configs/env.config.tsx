export const MEDIA_SERVER_HOST =
	process.env.REACT_APP_MEDIA_SERVER_HOST || '0.0.0.0';

export const MEDIA_SERVER_PORT =
	process.env.REACT_APP_MEDIA_SERVER_PORT || 8000;

export const MEDIA_SERVER_RTMP = `rtmp://${MEDIA_SERVER_HOST}:${MEDIA_SERVER_PORT}`;

export const SERVER_HOST = process.env.REACT_APP_SERVER_HOST || '0.0.0.0';
export const SERVER_PORT = process.env.REACT_APP_SERVER_PORT || 3000;
