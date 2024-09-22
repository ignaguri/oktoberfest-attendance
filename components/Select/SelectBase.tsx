"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  value: Option | Option[];
  onSelect: (option: Option) => void;
  renderValue: (value: Option | Option[]) => React.ReactNode;
  renderTrigger: (value: Option | Option[]) => React.ReactNode;
  disabled?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function SelectBase({
  id,
  buttonClassName,
  options,
  placeholder = "Select option",
  emptyMessage = "No option found.",
  value,
  onSelect,
  renderValue,
  renderTrigger,
  disabled = false,
  open,
  setOpen,
}: SelectBaseProps) {
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", buttonClassName)}
          disabled={disabled}
        >
          {renderTrigger(value)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandList>
            {options.map((group, groupIndex) => (
              <React.Fragment key={group.title || `group-${groupIndex}`}>
                {groupIndex > 0 && <CommandSeparator />}
                {group.title ? (
                  <CommandGroup heading={group.title}>
                    {group.options.map((option) => (
                      <CommandItem
                        key={option.value}
                        onSelect={() => onSelect(option)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            Array.isArray(value)
                              ? value.some(
                                  (item) => item.value === option.value,
                                )
                                ? "opacity-100"
                                : "opacity-0"
                              : value?.value === option.value
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
                      onSelect={() => onSelect(option)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          Array.isArray(value)
                            ? value.some((item) => item.value === option.value)
                              ? "opacity-100"
                              : "opacity-0"
                            : value?.value === option.value
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
      {renderValue(value)}
    </Popover>
  );
}
