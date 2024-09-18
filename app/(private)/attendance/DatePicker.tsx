import { useField, useFormikContext } from "formik";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import { formatDate } from "date-fns/format";
import { Button } from "@/components/ui/button";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";

import "react-datepicker/dist/react-datepicker.css";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
  onDateChange: (date: Date) => void;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
  onDateChange,
}: MyDatePickerProps) {
  const [field, meta, helpers] = useField(name);
  const { setFieldValue } = useFormikContext();

  const { value } = meta;
  const { setValue } = helpers;

  const handleDateChange = (date: Date) => {
    setValue(date);
    setFieldValue(name, date);
    onDateChange(date);
  };

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
          {formatDate(value, "dd/MM/yyyy")}
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
        onChange={(date) => handleDateChange(date as Date)}
        selected={value as Date}
        todayButton="Today"
      />
    </div>
  );
}
