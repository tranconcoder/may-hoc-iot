import styles from "./styles.module.scss";
import classnames from "classnames/bind";
import ReactPlayer, { Config, ReactPlayerProps } from "react-player";

const cx = classnames.bind(styles);

export interface CameraPreviewProps extends ReactPlayerProps {
    url: string;
}

export default function CameraPreview({ url, ...props }: CameraPreviewProps) {
    const config: Config = {
        file: { forceFLV: true },
    };


    return (
        <div className={cx("camera-preview-container")}>
            <ReactPlayer
                className={cx("preview")}
                url={url}
                config={config}
                muted
                playing
                {...props}
            />
        </div>
    );
}
