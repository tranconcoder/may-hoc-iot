import dayjs, { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
// Components
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { StaticDatePicker } from "@mui/x-date-pickers/StaticDatePicker";
// Hooks
import { useState } from "react";

export interface ChartDatePickerProps {
    handlePick(newDay: number, newMonth: number, newYear: number): void;
}

export default function ChartDatePicker({ handlePick }: ChartDatePickerProps) {
    const [date, setDate] = useState<Dayjs>(dayjs());

    const handleChange = (data: any) => {
        setDate(data);
        handlePick(data.date(), data.month(), data.year());
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <StaticDatePicker
                orientation="landscape"
                value={date}
                onChange={handleChange}
                maxDate={dayjs()}
            />
        </LocalizationProvider>
    );
}
