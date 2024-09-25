"use client";

import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

import type { Option, SelectBaseProps } from "./SelectBase";

import { SelectBase } from "./SelectBase";

interface MultiSelectProps
  extends Pick<
    SelectBaseProps,
    | "buttonClassName"
    | "options"
    | "placeholder"
    | "searchPlaceholder"
    | "emptyMessage"
    | "disabled"
    | "id"
  > {
  onSelect?: (option: Option) => void;
  onUnselect?: (option: Option) => void;
  value: Option["value"][];
  closeOnSelect?: boolean;
}

export function MultiSelect({
  buttonClassName,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  id,
  onSelect,
  onUnselect,
  value,
  closeOnSelect = false,
}: MultiSelectProps) {
  const [selected, setSelected] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const selectedOptions = options
      .flatMap((group) => group.options)
      .filter((opt) => value.includes(opt.value));
    setSelected(selectedOptions);
  }, [value, options]);

  const handleSelect = (option: Option) => {
    if (selected.some((item) => item.value === option.value)) {
      setSelected((prev) => prev.filter((item) => item.value !== option.value));
      onUnselect?.(option);
    } else {
      setSelected((prev) => [...prev, option]);
      onSelect?.(option);
    }
    if (closeOnSelect) setOpen(false);
  };

  const handleUnselect = (option: Option) => {
    setSelected((prev) => prev.filter((item) => item.value !== option.value));
    onUnselect?.(option);
  };

  return (
    <SelectBase
      buttonClassName={buttonClassName}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      value={selected}
      disabled={disabled}
      onSelect={handleSelect}
      id={id}
      open={open}
      setOpen={setOpen}
      renderValue={(value) => (
        <div className="mt-2 flex flex-wrap gap-1">
          {(value as Option[]).map((item) => (
            <Badge key={item.value} variant="secondary">
              {item.label}
              <button
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(item);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => handleUnselect(item)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      renderTrigger={(value) =>
        (value as Option[]).length > 0
          ? `${(value as Option[]).length} selected`
          : placeholder || "Select options"
      }
    />
  );
}
