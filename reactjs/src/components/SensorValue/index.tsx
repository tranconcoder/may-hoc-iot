import styles from "./styles.module.scss";
import classnames from "classnames/bind";

const cx = classnames.bind(styles);

export interface SensorValueProps {
    title: string;
    value: string;
}

export default function SensorValue({ title, value }: SensorValueProps) {
    return (
        <div className={cx("sensor-value")}>
            <span className={cx("title")}>{title}</span>
            <span className={cx("value")}>{value}</span>
        </div>
    );
}
