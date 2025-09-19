"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { useEffect, useState } from "react";

import type {
  ComboboxOption,
  ComboboxOptionGroup,
} from "@/components/ui/combobox";

interface MultiSelectProps {
  id?: string;
  buttonClassName?: string;
  className?: string;
  options: ComboboxOptionGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  errorMsg?: string;
  onSelect?: (option: ComboboxOption) => void;
  onUnselect?: (option: ComboboxOption) => void;
  value: ComboboxOption["value"][];
}

export function MultiSelect({
  buttonClassName,
  className,
  options,
  placeholder,
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  disabled = false,
  id,
  onSelect,
  onUnselect,
  value,
  errorMsg,
}: MultiSelectProps) {
  const [selected, setSelected] = useState<ComboboxOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const selectedOptions = options
      .flatMap((group) => group.options)
      .filter((opt) => value.includes(opt.value));
    setSelected(selectedOptions);
  }, [value, options]);

  const handleSelect = (option: ComboboxOption) => {
    if (selected.some((item) => item.value === option.value)) {
      setSelected((prev) => prev.filter((item) => item.value !== option.value));
      onUnselect?.(option);
    } else {
      setSelected((prev) => [...prev, option]);
      onSelect?.(option);
    }
  };

  const handleUnselect = (option: ComboboxOption) => {
    setSelected((prev) => prev.filter((item) => item.value !== option.value));
    onUnselect?.(option);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              errorMsg &&
                "border-red-500 bg-red-50 text-red-900 placeholder:text-red-700 focus:ring-red-500",
              buttonClassName,
            )}
            disabled={disabled}
          >
            {selected.length > 0
              ? `${selected.length} selected`
              : placeholder || "Select options"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-8" />
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandList>
              {options.map((group, groupIndex) => (
                <CommandGroup
                  key={group.title || `group-${groupIndex}`}
                  heading={group.title}
                >
                  {group.options.map((option: ComboboxOption) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option)}
                    >
                      {option.label}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selected.some((item) => item.value === option.value)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <Badge key={item.value} variant="secondary">
              {item.label}
              <button
                className="ml-1 ring-offset-background rounded-full outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
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

      {errorMsg && <span className="text-sm text-red-600">{errorMsg}</span>}
    </div>
  );
}
