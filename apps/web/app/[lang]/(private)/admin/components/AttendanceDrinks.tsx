"use client";

import {
  useAddAdminConsumption,
  useAdminAttendanceConsumptions,
  useDeleteAdminConsumption,
  useUpdateAdminConsumption,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Consumption, DrinkType } from "@prostcounter/shared/schemas";
import { DrinkTypeSchema } from "@prostcounter/shared/schemas";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VISIBLE_DRINK_TYPES } from "@/components/attendance/drink-type-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// A stored drink may be `other`, which the pickers no longer offer for new ones
const ALL_DRINK_TYPES = DrinkTypeSchema.options;

function DrinkTypeSelect({
  value,
  onChange,
  disabled,
  label,
  types,
}: {
  value: DrinkType;
  onChange: (value: DrinkType) => void;
  disabled?: boolean;
  label: string;
  types: readonly DrinkType[];
}) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as DrinkType)} disabled={disabled}>
      <SelectTrigger className="w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {types.map((type) => (
          <SelectItem key={type} value={type}>
            {t(`attendance.drinkTypes.${type}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A day's logged drinks: change a drink's type, remove it, or add one. Each
 * change saves right away; the server re-prices a retyped drink.
 */
export function AttendanceDrinks({ attendanceId }: { attendanceId: string }) {
  const { t } = useTranslation();
  const { consumptions, isLoading, error } = useAdminAttendanceConsumptions(attendanceId);
  const addConsumption = useAddAdminConsumption();
  const updateConsumption = useUpdateAdminConsumption();
  const deleteConsumption = useDeleteAdminConsumption();
  const [newType, setNewType] = useState<DrinkType>("beer");

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      toast.error(t("admin.users.attendances.drinks.error"));
    }
  };

  const handleRetype = (consumption: Consumption, drinkType: DrinkType) =>
    run(() =>
      updateConsumption.mutate({ consumptionId: consumption.id, data: { drink_type: drinkType } }),
    );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{t("admin.users.attendances.drinks.hint")}</p>

      {isLoading && (
        <p className="text-muted-foreground text-sm">
          {t("admin.users.attendances.drinks.loading")}
        </p>
      )}

      {error && (
        <p className="text-muted-foreground text-sm">
          {t("admin.users.attendances.drinks.loadError")}
        </p>
      )}

      {!isLoading && !error && consumptions.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("admin.users.attendances.drinks.empty")}</p>
      )}

      <ul className="space-y-2">
        {consumptions.map((consumption) => (
          <li key={consumption.id} className="flex items-center gap-2">
            <DrinkTypeSelect
              value={consumption.drinkType}
              onChange={(drinkType) => handleRetype(consumption, drinkType)}
              disabled={updateConsumption.loading}
              label={t("admin.users.attendances.drinks.type")}
              types={ALL_DRINK_TYPES}
            />
            <span className="text-muted-foreground flex-1 text-sm">
              {`€${(consumption.pricePaidCents / 100).toFixed(2)}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={deleteConsumption.loading}
              onClick={() => run(() => deleteConsumption.mutate(consumption.id))}
              aria-label={t("admin.users.attendances.drinks.remove")}
            >
              <Trash size={14} />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 border-t pt-4">
        <DrinkTypeSelect
          value={newType}
          onChange={setNewType}
          label={t("admin.users.attendances.drinks.type")}
          types={VISIBLE_DRINK_TYPES}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={addConsumption.loading || !!error}
          onClick={() =>
            run(() => addConsumption.mutate({ attendanceId, data: { drink_type: newType } }))
          }
        >
          <Plus size={14} />
          {t("admin.users.attendances.drinks.add")}
        </Button>
      </div>
    </div>
  );
}
