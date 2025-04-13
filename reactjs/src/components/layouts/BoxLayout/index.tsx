import styles from './styles.module.scss';
import classnames from 'classnames/bind';
import ButtonSimple, { ButtonSimpleProps } from '../../common/ButtonSimple';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';

const cx = classnames.bind(styles);

export type OutletPassType = [
	React.Dispatch<React.SetStateAction<string>>,
	React.Dispatch<React.SetStateAction<ButtonSimpleProps | undefined>>
];

export default function BoxLayout() {
	const [title, setTitle] = useState('');
	const [buttonProps, setButtonProps] = useState<ButtonSimpleProps>();

	return (
		<div className={cx('container')}>
			<div className={cx('box')}>
				<header className={cx('header')}>{title}</header>

				<div className={cx('body')}>
					<Outlet context={[setTitle, setButtonProps]} />
				</div>
			</div>

			{buttonProps && (
				<ButtonSimple {...buttonProps} className={cx('button')}>
					{buttonProps?.children}
				</ButtonSimple>
			)}
		</div>
	);
}
