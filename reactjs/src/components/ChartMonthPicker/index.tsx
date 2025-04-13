import { LocalizationProvider, MonthCalendar } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { useState } from "react";

export interface ChartMonthPickerProps {
    handlePick: (month: number, year: number) => void;
}

export default function ChartMonthPicker({ handlePick }: ChartMonthPickerProps) {
    const [month, setMonth] = useState<Dayjs>(dayjs());

    const handleChange = (data: Dayjs) => {
        setMonth(data);
        handlePick(data.month(), data.year());
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <MonthCalendar value={month} onChange={handleChange} />
        </LocalizationProvider>
    );
}
