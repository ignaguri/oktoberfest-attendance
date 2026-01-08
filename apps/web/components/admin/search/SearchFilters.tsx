"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import { useState } from "react";

import type { ReactNode } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface SearchFilter {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox" | "date" | "dateRange";
  options?: FilterOption[];
  placeholder?: string;
  value: any;
  onChange: (value: any) => void;
}

export interface SearchFiltersProps {
  filters: SearchFilter[];
  onClearAll?: () => void;
  className?: string;
  showClearAll?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  title?: string;
  children?: ReactNode;
}

export function SearchFilters({
  filters,
  onClearAll,
  className,
  showClearAll = true,
  collapsible = true,
  defaultCollapsed = true,
  title = "Filters",
  children,
}: SearchFiltersProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const hasActiveFilters = filters.some((filter) => {
    if (filter.type === "checkbox") {
      return Array.isArray(filter.value)
        ? filter.value.length > 0
        : filter.value;
    }
    if (filter.type === "dateRange") {
      return filter.value?.from || filter.value?.to;
    }
    return filter.value !== "" && filter.value != null;
  });

  const renderFilter = (filter: SearchFilter) => {
    switch (filter.type) {
      case "text":
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Input
              id={filter.key}
              type="text"
              value={filter.value || ""}
              onChange={(e) => filter.onChange(e.target.value)}
              placeholder={filter.placeholder}
            />
          </div>
        );

      case "select":
        return (
          <div key={filter.key} className="space-y-2">
            <Label>{filter.label}</Label>
            <Select value={filter.value || ""} onValueChange={filter.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={filter.placeholder || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "checkbox":
        const checkboxValue = Array.isArray(filter.value) ? filter.value : [];
        return (
          <div key={filter.key} className="space-y-2">
            <Label>{filter.label}</Label>
            <div className="space-y-2">
              {filter.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${filter.key}-${option.value}`}
                    checked={checkboxValue.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        filter.onChange([...checkboxValue, option.value]);
                      } else {
                        filter.onChange(
                          checkboxValue.filter((v) => v !== option.value),
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`${filter.key}-${option.value}`}
                    className="text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case "date":
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Input
              id={filter.key}
              type="date"
              value={filter.value || ""}
              onChange={(e) => filter.onChange(e.target.value)}
            />
          </div>
        );

      case "dateRange":
        return (
          <div key={filter.key} className="space-y-2">
            <Label>{filter.label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={filter.value?.from || ""}
                onChange={(e) =>
                  filter.onChange({
                    ...filter.value,
                    from: e.target.value,
                  })
                }
                placeholder="From"
              />
              <Input
                type="date"
                value={filter.value?.to || ""}
                onChange={(e) =>
                  filter.onChange({
                    ...filter.value,
                    to: e.target.value,
                  })
                }
                placeholder="To"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">{title}</span>
          {hasActiveFilters && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs">
              {filters.filter((f) => f.value).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showClearAll && hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-8 px-2"
            >
              <X className="mr-1 h-3 w-3" />
              Clear All
            </Button>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 px-2"
            >
              {isCollapsed ? "Show" : "Hide"}
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filters.map(renderFilter)}
          {children}
        </div>
      )}
    </div>
  );
}
