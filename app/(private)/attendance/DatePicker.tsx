import { useField } from "formik";
import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import { formatDate } from "date-fns/format";
import { Button } from "@/components/ui/button";

// Styles
import "react-datepicker/dist/react-datepicker.css";
import { BEGINNING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
}: MyDatePickerProps) {
  const [field, meta, helpers] = useField(name);

  const { value } = meta;
  const { setValue } = helpers;

  const handleOnChange = (date: Date | null) => {
    setValue(date as Date);
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
        onChange={handleOnChange}
        selected={value}
        todayButton="Today"
      />
    </div>
  );
}
