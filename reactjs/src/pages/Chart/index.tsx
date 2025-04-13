import { ChartTimeRangeEnum } from "../../enum/chart.enum";
import dayjs from "dayjs";

import styles from "./styles.module.scss";
import classNames from "classnames/bind";
// Components
import ChartTimeRange from "../../components/ChartTimeRange";
import { OutletPassType } from "../../components/layouts/BoxLayout";
import ChartWeekPicker from "../../components/ChartWeekPicker";
import ChartYearPicker from "../../components/ChartYearPicker";
import ChartMonthPicker from "../../components/ChartMonthPicker";
import ChartDatePicker from "../../components/ChartDatePicker";
// Hooks
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { LineChart } from "@mui/x-charts";
import {
    convertEnvironmentSchemaListToDayAxesData,
    convertEnvironmentSchemaListToMonthAxesData,
    convertEnvironmentSchemaListToWeekAxesData,
    convertEnvironmentSchemaListToYearAxesData,
    generateParamsToGetInfo,
    generateXLabelsDay,
    generateXLabelsMonth,
    generateXLabelsWeek,
    generateXLabelsYear,
} from "../../utils/chart.util";
import axiosInstance from "../../services/axios";

const cx = classNames.bind(styles);

export default function ChartPage() {
    const now = dayjs();
    const [setTitle, setButtonProps] = useOutletContext<OutletPassType>();
    const [timeRange, setTimeRange] = useState<ChartTimeRangeEnum>(
        ChartTimeRangeEnum.Day
    );
    const [date, setDate] = useState<number>(now.date());
    const [week, setWeek] = useState<number>(now.week());
    const [month, setMonth] = useState<number>(now.month());
    const [year, setYear] = useState<number>(now.year());
    const [tempData, setTempData] = useState<Array<number>>([]);
    const [humidityData, setHumidityData] = useState<Array<number>>([]);
    const [xLabels, setXLabels] = useState<Array<string>>(generateXLabelsDay());

    const handleChangeTimeRange = (newTimeRange: ChartTimeRangeEnum) => {
        setTimeRange(newTimeRange);
    };
    const handlePickDate = (
        newDate: number,
        newMonth: number,
        newYear: number
    ) => {
        setDate(newDate);
        setMonth(newMonth);
        setYear(newYear);
    };
    const handlePickMonth = (newMonth: number, newYear: number) => {
        setMonth(newMonth);
        setYear(newYear);
    };
    const handlePickYear = (newYear: number) => {
        setYear(newYear);
    };
    const handlePickWeek = (newWeek: number, newYear: number) => {
        setWeek(newWeek);
        setYear(newYear);
    };

    useEffect(() => {
        setTitle("Biểu đồ");
        setButtonProps(undefined);
    });

    // Update xLabels axes
    // Update axes data
    useEffect(() => {
        axiosInstance
            .get("/environment/get-info", {
                params: generateParamsToGetInfo(
                    timeRange,
                    date,
                    week,
                    month,
                    year
                ),
            })
            .then(({ data }) => {
                let axesData: {
                    tempData: Array<number>;
                    humidityData: Array<number>;
                } = { tempData: [], humidityData: [] };

                if (timeRange === ChartTimeRangeEnum.Day) {
                    axesData = convertEnvironmentSchemaListToDayAxesData(data);
                    setXLabels(generateXLabelsDay());
                }
                if (timeRange === ChartTimeRangeEnum.Week) {
                    axesData = convertEnvironmentSchemaListToWeekAxesData(data);
                    setXLabels(generateXLabelsWeek(week, year));
                }
                if (timeRange === ChartTimeRangeEnum.Month) {
                    axesData =
                        convertEnvironmentSchemaListToMonthAxesData(data);
                    setXLabels(generateXLabelsMonth(month + 1, year));
                }
                if (timeRange === ChartTimeRangeEnum.Year) {
                    axesData = convertEnvironmentSchemaListToYearAxesData(data);
                    setXLabels(generateXLabelsYear());
                }

                setTempData(axesData.tempData);
                setHumidityData(axesData.humidityData);
            });
    }, [timeRange, date, week, month, year]); // eslint-disable-line

    return (
        <div className={cx("chart-container")}>
            <div className={cx("chart-option")}>
                <ChartTimeRange onChangeTimeRange={handleChangeTimeRange} />

                {timeRange === ChartTimeRangeEnum.Day && (
                    <ChartDatePicker handlePick={handlePickDate} />
                )}

                {timeRange === ChartTimeRangeEnum.Week && (
                    <ChartWeekPicker handlePick={handlePickWeek} />
                )}

                {timeRange === ChartTimeRangeEnum.Month && (
                    <ChartMonthPicker handlePick={handlePickMonth} />
                )}

                {timeRange === ChartTimeRangeEnum.Year && (
                    <ChartYearPicker handlePick={handlePickYear} />
                )}
            </div>

            <LineChart
                width={1200}
                height={500}
                series={[
                    {
                        data: tempData,
                        label: "Nhiệt độ",
                        yAxisId: "leftAxisId",
                        color: "#ff6666",
                        area: true,
                    },
                    {
                        data: humidityData,
                        label: "Độ ẩm",
                        yAxisId: "rightAxisId",
                        color: "#0066ff",
                        area: true,
                    },
                ]}
                xAxis={[{ scaleType: "point", data: xLabels }]}
                yAxis={[{ id: "leftAxisId" }, { id: "rightAxisId" }]}
                rightAxis="rightAxisId"
            />
        </div>
    );
}
