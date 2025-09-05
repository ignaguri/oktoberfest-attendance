"use client";

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
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

export interface Option {
  value: string;
  label: string;
}

export interface OptionGroup {
  title?: string;
  options: Option[];
}

export interface SelectBaseProps {
  id?: string;
  buttonClassName?: string;
  options: OptionGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  errorMsg?: string;
}

export function SelectBase({
  id,
  buttonClassName,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  value,
  onValueChange,
  disabled = false,
  errorMsg,
}: SelectBaseProps) {
  const [open, setOpen] = React.useState(false);

  const allOptions = options.flatMap((group) => group.options);
  const selectedOption = allOptions.find((option) => option.value === value);

  return (
    <>
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
            {selectedOption ? selectedOption.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandList>
              {options.map((group, groupIndex) => (
                <React.Fragment key={group.title || `group-${groupIndex}`}>
                  {group.title ? (
                    <CommandGroup heading={group.title}>
                      {group.options.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.label}
                          onSelect={() => {
                            onValueChange(
                              option.value === value ? "" : option.value,
                            );
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === option.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {option.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : (
                    group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => {
                          onValueChange(
                            option.value === value ? "" : option.value,
                          );
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))
                  )}
                </React.Fragment>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {errorMsg && (
        <span className="w-full text-center text-sm text-red-600">
          {errorMsg}
        </span>
      )}
    </>
  );
}
