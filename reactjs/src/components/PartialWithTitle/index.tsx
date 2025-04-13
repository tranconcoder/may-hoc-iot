import styles from "./styles.module.scss";
import classnames from "classnames/bind";
import { HTMLAttributes, ReactNode } from "react";

const cx = classnames.bind(styles);

export interface PartialWithTitleProps extends HTMLAttributes<HTMLDivElement>{
    title: string;
           children: ReactNode
}

export default function PartialWithTitle({
    children,
    title,
    className,
    ...props
}: PartialWithTitleProps) {
    return (
        <section className={cx("partial-container")}>
            <h3 className={cx("title")}>{title}</h3>

            <div className={cx("line-break")}></div>

            <div {...props} className={cx("content").addClass(className)}>{children}</div>
        </section>
    );
}
