import { useField } from "formik";
import { useState } from "react";
import DatePicker from "react-datepicker";
import { formatDate } from "date-fns/format";

// Styles
import "react-datepicker/dist/react-datepicker.css";
import { BEGGINING_OF_WIESN, END_OF_WIESN } from "@/lib/constants";

interface MyDatePickerProps {
  disabled?: boolean;
  name?: string;
}

export function MyDatePicker({
  disabled = false,
  name = "date",
}: MyDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [field, meta, helpers] = useField(name);

  const { value } = meta;
  const { setValue } = helpers;

  const handleOnChange = (date: Date | null) => {
    setIsOpen(!isOpen);
    setValue(date as Date);
  };

  const handleOnClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        className="input"
        disabled={disabled}
        onClick={handleOnClick}
        suppressHydrationWarning
      >
        {formatDate(value, "dd/MM/yyyy")}
      </button>
      {isOpen && (
        <DatePicker
          {...field}
          dateFormat="dd/MM/yyyy"
          inline
          maxDate={END_OF_WIESN}
          minDate={BEGGINING_OF_WIESN}
          onChange={handleOnChange}
          onClickOutside={() => setIsOpen(false)}
          selected={value}
          todayButton="Today"
        />
      )}
    </>
  );
}
