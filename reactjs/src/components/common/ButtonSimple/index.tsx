// Types
import type {
	AnchorHTMLAttributes,
	ButtonHTMLAttributes,
	PropsWithChildren,
	MouseEvent,
} from 'react';
import type { IconType } from 'react-icons';

// Styles
import styles from './styles.module.scss';
import classnames from 'classnames/bind';
import { useNavigate } from 'react-router-dom';

const cx = classnames.bind(styles);

// Props type
interface ButtonSimpleCustomProps extends PropsWithChildren {
	redirect?: string;
	Icon?: IconType;
	type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
}

export type ButtonSimpleProps = ButtonSimpleCustomProps &
	(ButtonHTMLAttributes<HTMLButtonElement> &
		AnchorHTMLAttributes<HTMLAnchorElement>);

// Component
export default function ButtonSimple({
	redirect,
	children,
	Icon,
	className,
	onClick,
	...props
}: ButtonSimpleProps) {
	const navigate = useNavigate();

	const Button = redirect ? 'a' : 'button';
	const handleRedirect = redirect
		? (e: MouseEvent<HTMLAnchorElement & HTMLButtonElement>) => {
				onClick && onClick(e);
				navigate(redirect);
		  }
		: onClick;

	return (
		<Button
			{...props}
			className={cx('button-container').addClass(className)}
			onClick={handleRedirect}
		>
			{Icon && <Icon />}

			<p>{children}</p>
		</Button>
	);
}
