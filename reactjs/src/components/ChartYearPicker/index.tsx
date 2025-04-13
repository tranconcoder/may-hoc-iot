import { LocalizationProvider, YearCalendar } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { useState } from "react";

export interface ChartYearPickerProps {
    handlePick: (year: number) => void;
}

export default function ChartYearPicker({ handlePick }: ChartYearPickerProps) {
    const [year, setYear] = useState<Dayjs>(dayjs());

    const handleChange = (data: Dayjs) => {
        setYear(data);
        handlePick(data.year());
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <YearCalendar value={year} onChange={handleChange} maxDate={dayjs()} />
        </LocalizationProvider>
    );
}
