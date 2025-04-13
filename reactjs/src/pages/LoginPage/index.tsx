import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import classnames from 'classnames/bind';
import styles from './styles.module.scss';
import { OutletPassType } from '../../components/layouts/BoxLayout';
import axiosInstance from '../../services/axios';

const cx = classnames.bind(styles);

const LoginPage: React.FC = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [setTitle, setButtonProps] = useOutletContext<OutletPassType>();

	const handleLogin = useCallback(
		(event: React.FormEvent) => {
			event.preventDefault();

			axiosInstance.post('/auth/login', { email, password }).then((res) => {
				console.log(res.data);
			});
		},
		[email, password] // Dependencies
	);

	// Set the title and button props for the BoxLayout
	useEffect(() => {
		setTitle('Login');
		setButtonProps({
			children: 'Submit',
			onClick: handleLogin,
		});
	}, [email, password]); // Dependencies

	return (
		<div className={cx('login-container')}>
			<form onSubmit={handleLogin}>
				<div className={cx('form-group')}>
					<label htmlFor="email">Email:</label>
					<input
						type="email"
						id="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>
				<div className={cx('form-group')}>
					<label htmlFor="password">Password:</label>
					<input
						type="password"
						id="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
			</form>
		</div>
	);
};

export default LoginPage;
