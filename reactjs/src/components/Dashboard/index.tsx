import type { OutletPassType } from '../layouts/BoxLayout';

// Styles
import styles from './styles.module.scss';
import classnames from 'classnames/bind';
// Components
import PartialWithTitle from '../PartialWithTitle';
import CameraPreview from '../CameraPreview';
import SensorValue from '../SensorValue';
// Hooks
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
// Configs
import { DHT_DATA_UPDATE_TIME } from '../../configs/sensor.config';
import {
	LIVE_STREAM_SECURITY_GATE_PATH_FLV,
	LIVE_STREAM_MONITOR_PATH_FLV,
} from '../../configs/stream.config';
// Services
import axiosInstance from '../../services/axios';

const cx = classnames.bind(styles);

export default function Dashboard() {
	const [setTitle, setButtonProps] = useOutletContext<OutletPassType>();
	const [temp, setTemp] = useState(0);
	const [humidity, setHumidity] = useState(0);

	const updateData = async () => {
		const { data } = await axiosInstance.get('/environment/get-current-info');

		setTemp(data.temp);
		setHumidity(data.humidity);
	};

	// Update UI
	useEffect(() => {
		setTitle('Dashboard');
		setButtonProps({
			redirect: '/chart',
			children: 'Xem biểu đồ',
		});
	}, []); // eslint-disable-line

	// Update sensor value
	useEffect(() => {
		updateData();
		const intervalId = setInterval(updateData, DHT_DATA_UPDATE_TIME);

		return () => clearInterval(intervalId);
	}, []);

	return (
		<div className={cx('container')}>
			<PartialWithTitle
				title="Camera giám sát"
				className={cx('camera-partial')}
			>
				<CameraPreview url={LIVE_STREAM_SECURITY_GATE_PATH_FLV} />

				<CameraPreview url={LIVE_STREAM_MONITOR_PATH_FLV} />
			</PartialWithTitle>

			<PartialWithTitle className={cx('sensor-partial')} title="Thông số">
				<SensorValue title="Nhiệt độ" value={`${temp}°C`} />

				<SensorValue title="Độ ẩm" value={`${humidity}%`} />
			</PartialWithTitle>
		</div>
	);
}
