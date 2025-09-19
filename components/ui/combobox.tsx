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

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxOptionGroup {
  title?: string;
  options: ComboboxOption[];
}

export interface ComboboxProps {
  options: ComboboxOptionGroup[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  errorMsg?: string;
  id?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No option found.",
  disabled = false,
  className,
  buttonClassName,
  errorMsg,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const allOptions = options.flatMap((group) => group.options);
  const selectedOption = allOptions.find((option) => option.value === value);

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
            {selectedOption ? selectedOption.label : placeholder}
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
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {options.map((group, groupIndex) => (
                <CommandGroup
                  key={group.title || `group-${groupIndex}`}
                  heading={group.title}
                >
                  {group.options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        onValueChange?.(
                          currentValue === value ? "" : currentValue,
                        );
                        setOpen(false);
                      }}
                    >
                      {option.label}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0",
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
      {errorMsg && <span className="text-sm text-red-600">{errorMsg}</span>}
    </div>
  );
}
