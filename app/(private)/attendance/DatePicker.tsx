import { useField } from "formik";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import { formatDate } from "date-fns/format";
import { Button } from "@/components/ui/button";
import { BEGINNING_OF_WIESN, END_OF_WIESN, TIMEZONE } from "@/lib/constants";

import "react-datepicker/dist/react-datepicker.css";
import { TZDate } from "@date-fns/tz";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
  onDateChange: (date: Date | null) => void;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
  onDateChange,
}: MyDatePickerProps) {
  const [field, meta] = useField(name);
  const { value } = meta;

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
        {...field}
        dateFormat="dd/MM/yyyy"
        maxDate={END_OF_WIESN}
        minDate={BEGINNING_OF_WIESN}
        customInput={<CustomInput />}
        onChange={onDateChange}
        selected={value as Date}
        todayButton="Today"
      />
    </div>
  );
}
