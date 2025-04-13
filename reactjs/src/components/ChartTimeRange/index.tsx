import {
    FormControl,
    FormControlOwnProps,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";
import { useEffect, useState } from "react";
import { ChartTimeRangeEnum } from "../../enum/chart.enum";

export interface ChartTimeRangeProps extends FormControlOwnProps {
    onChangeTimeRange: (timeRange: ChartTimeRangeEnum) => void;
}

export default function ChartTimeRange({
    onChangeTimeRange,
    ...props
}: ChartTimeRangeProps) {
    const [timeRange, setTimeRange] = useState<ChartTimeRangeEnum>(
        ChartTimeRangeEnum.Day
    );

    const handleChangeTimeRange = (
        e: SelectChangeEvent<ChartTimeRangeEnum>
    ) => {
        const newTimeRange = e.target.value as ChartTimeRangeEnum;

        setTimeRange(newTimeRange);
        onChangeTimeRange(newTimeRange);
    };

    // Pass default timeRange to parent
    useEffect(() => {
        onChangeTimeRange(timeRange);
    }, []); // eslint-disable-line

    return (
        <FormControl {...props} sx={{ m: 2, minWidth: 150 }}>
            <InputLabel id="demo-simple-select-filled-label">
                Thời gian
            </InputLabel>

            <Select
                labelId="demo-simple-select-filled-label"
                id="demo-simple-filled-select"
                onChange={handleChangeTimeRange}
                value={timeRange}
                label="Thời gian"
            >
                <MenuItem value={ChartTimeRangeEnum.Day}>Ngày</MenuItem>
                <MenuItem value={ChartTimeRangeEnum.Week}>Tuần</MenuItem>
                <MenuItem value={ChartTimeRangeEnum.Month}>Tháng</MenuItem>
                <MenuItem value={ChartTimeRangeEnum.Year}>Năm</MenuItem>
            </Select>
        </FormControl>
    );
}
