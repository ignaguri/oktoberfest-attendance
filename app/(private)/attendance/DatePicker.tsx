import { Button } from "@/components/ui/button";
import { BEGINNING_OF_WIESN, END_OF_WIESN, TIMEZONE } from "@/lib/constants";
import { TZDate } from "@date-fns/tz";
import { formatDate } from "date-fns/format";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
  onDateChange: (date: Date | null) => void;
  value?: Date;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
  onDateChange,
  value = new Date(),
}: MyDatePickerProps) {
  type ButtonProps = React.HTMLProps<HTMLButtonElement>;
  const CustomInput = forwardRef<HTMLButtonElement, ButtonProps>(
    function CustomInput({ onClick }, ref) {
      return (
        <Button
          variant="outline"
          className="h-11 px-4"
          disabled={disabled}
          onClick={onClick}
          ref={ref}
          type="button"
        >
          {formatDate(new TZDate(value, TIMEZONE), "dd/MM/yyyy")}
        </Button>
      );
    },
  );

  return (
    <div className="w-full">
      <DatePicker
        name={name}
        dateFormat="dd/MM/yyyy"
        maxDate={END_OF_WIESN}
        minDate={BEGINNING_OF_WIESN}
        customInput={<CustomInput />}
        onChange={onDateChange}
        selected={value}
        todayButton="Today"
      />
    </div>
  );
}
