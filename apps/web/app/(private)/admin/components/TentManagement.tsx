"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  type AdminAddTentToFestivalForm,
  AdminAddTentToFestivalFormSchema,
  type AdminCopyTentsForm,
  AdminCopyTentsFormSchema,
} from "@prostcounter/shared/schemas";
import { Copy, Edit, Euro, Plus, Tent, Trash2 } from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Festival } from "@/lib/types";

import { fetchAllFestivals } from "../festivalActions";
import {
  addAllAvailableTentsToFestival,
  addTentToFestival,
  copyTentsToFestival,
  createTent,
  getAvailableTents,
  getFestivalTents,
  getFestivalTentStats,
  removeTentFromFestival,
  type TentWithPrice,
  updateTentPrice,
} from "../tentActions";

const TENT_CATEGORIES = [
  "Beer Halls",
  "Beer Gardens",
  "Traditional",
  "Modern",
  "Food Stands",
  "Other",
];

export default function TentManagement() {
  const { t } = useTranslation();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [selectedFestival, setSelectedFestival] = useState<string>("");
  const [festivalTents, setFestivalTents] = useState<TentWithPrice[]>([]);
  const [availableTents, setAvailableTents] = useState<any[]>([]);
  const [tentStats, setTentStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  // Forms
  const createTentForm = useForm<AdminAddTentToFestivalForm>({
    resolver: zodResolver(AdminAddTentToFestivalFormSchema),
    defaultValues: {
      name: "",
      category: "",
      latitude: null,
      longitude: null,
      beer_price: null,
    },
  });

  const copyTentsForm = useForm<AdminCopyTentsForm>({
    resolver: zodResolver(AdminCopyTentsFormSchema),
    defaultValues: {
      sourceFestivalId: "",
      targetFestivalId: selectedFestival,
      tentIds: [],
      copyPrices: true,
      overridePrice: null,
    },
  });

  // Load festivals on component mount
  useEffect(() => {
    const loadFestivals = async () => {
      try {
        const festivalsData = await fetchAllFestivals();
        setFestivals(festivalsData);
        if (festivalsData.length > 0 && !selectedFestival) {
          // Select the most recent active festival
          const activeFestival = festivalsData.find((f) => f.is_active);
          setSelectedFestival(activeFestival?.id || festivalsData[0].id);
        }
      } catch (error) {
        console.error("Error loading festivals:", error);
        toast.error(t("notifications.error.festivalLoadFailed"));
      }
    };
    loadFestivals();
  }, []);

  // Load tent data when festival selection changes
  useEffect(() => {
    if (selectedFestival) {
      loadFestivalData();
    }
  }, [selectedFestival]);

  const loadFestivalData = async () => {
    if (!selectedFestival) return;

    setIsLoading(true);
    try {
      const [tentsData, availableData, statsData] = await Promise.all([
        getFestivalTents(selectedFestival),
        getAvailableTents(selectedFestival),
        getFestivalTentStats(selectedFestival),
      ]);

      setFestivalTents(tentsData);
      setAvailableTents(availableData);
      setTentStats(statsData);
    } catch (error) {
      console.error("Error loading festival data:", error);
      toast.error(t("notifications.error.tentLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTent = async (data: AdminAddTentToFestivalForm) => {
    try {
      await createTent(
        {
          name: data.name,
          category: data.category || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        },
        selectedFestival,
        data.beer_price,
      );
      toast.success(t("notifications.success.tentCreated"));
      createTentForm.reset();
      setShowAddDialog(false);
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const handleAddExistingTent = async (
    tentId: string,
    beerPrice?: number | null,
  ) => {
    try {
      await addTentToFestival(selectedFestival, tentId, beerPrice);
      toast.success(t("notifications.success.tentAddedToFestival"));
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const handleAddAllAvailableTents = async () => {
    try {
      const result = await addAllAvailableTentsToFestival(selectedFestival);
      toast.success(
        t("notifications.success.tentsAddedToFestival", {
          count: result.added,
        }),
      );
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const handleRemoveTent = async (tentId: string) => {
    try {
      await removeTentFromFestival(selectedFestival, tentId);
      toast.success(t("notifications.success.tentRemovedFromFestival"));
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const handleUpdatePrice = async (tentId: string, price: number | null) => {
    try {
      await updateTentPrice(selectedFestival, tentId, price);
      toast.success(t("notifications.success.priceUpdated"));
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const handleCopyTents = async (data: AdminCopyTentsForm) => {
    try {
      await copyTentsToFestival(
        data.sourceFestivalId,
        selectedFestival,
        data.tentIds,
        {
          copyPrices: data.copyPrices,
          overridePrice: data.overridePrice,
        },
      );
      toast.success(
        t("notifications.success.tentsCopied", { count: data.tentIds.length }),
      );
      copyTentsForm.reset();
      setShowCopyDialog(false);
      await loadFestivalData();
    } catch (error: any) {
      toast.error(error.message || t("notifications.error.generic"));
    }
  };

  const selectedFestivalData = festivals.find((f) => f.id === selectedFestival);

  const formatPrice = (price: number | null) => {
    if (price === null) return t("admin.tents.badges.default");
    return `€${price.toFixed(2)}`;
  };

  const getCategoryBadgeVariant = (category: string | null) => {
    if (!category) return "secondary";
    switch (category) {
      case "Beer Halls":
        return "default";
      case "Beer Gardens":
        return "outline";
      case "Traditional":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (festivals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.tents.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{t("admin.festivals.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tent className="h-5 w-5" />
            {t("admin.tents.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="festival-select">
              {t("admin.tents.selectFestival")}
            </Label>
            <Select
              value={selectedFestival}
              onValueChange={setSelectedFestival}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("admin.tents.chooseFestival")} />
              </SelectTrigger>
              <SelectContent>
                {festivals.map((festival) => (
                  <SelectItem key={festival.id} value={festival.id}>
                    {festival.name} ({festival.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          {tentStats && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {tentStats.total_tents}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("admin.tents.stats.total")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {tentStats.with_custom_pricing}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("admin.tents.stats.customPricing")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {tentStats.avg_price > 0
                    ? `€${tentStats.avg_price.toFixed(2)}`
                    : "N/A"}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("admin.tents.stats.avgPrice")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Object.keys(tentStats.categories).length}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("admin.tents.stats.categories")}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedFestival && (
        <>
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("admin.tents.createNew")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {t("admin.tents.dialog.createTitle")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("admin.tents.dialog.createDescription")}{" "}
                    {selectedFestivalData?.name}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={createTentForm.handleSubmit(handleCreateTent)}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tent-name">
                        {t("admin.tents.form.name")}
                      </Label>
                      <Input
                        id="tent-name"
                        {...createTentForm.register("name")}
                        placeholder={t("admin.tents.form.namePlaceholder")}
                      />
                      {createTentForm.formState.errors.name && (
                        <p className="mt-1 text-sm text-red-600">
                          {createTentForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="tent-category">
                        {t("admin.tents.form.category")}
                      </Label>
                      <Select
                        value={createTentForm.watch("category") || ""}
                        onValueChange={(value) =>
                          createTentForm.setValue("category", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "admin.tents.form.categoryPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {TENT_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tent-latitude">
                          {t("admin.tents.form.latitude")}
                        </Label>
                        <Input
                          id="tent-latitude"
                          type="number"
                          step="0.0001"
                          placeholder={t(
                            "admin.tents.form.latitudePlaceholder",
                          )}
                          {...createTentForm.register("latitude", {
                            valueAsNumber: true,
                            setValueAs: (value) =>
                              value === "" ? null : value,
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="tent-longitude">
                          {t("admin.tents.form.longitude")}
                        </Label>
                        <Input
                          id="tent-longitude"
                          type="number"
                          step="0.0001"
                          placeholder={t(
                            "admin.tents.form.longitudePlaceholder",
                          )}
                          {...createTentForm.register("longitude", {
                            valueAsNumber: true,
                            setValueAs: (value) =>
                              value === "" ? null : value,
                          })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="beer-price">
                        {t("admin.tents.form.beerPrice")}
                      </Label>
                      <div className="relative">
                        <Euro className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                        <Input
                          id="beer-price"
                          type="number"
                          step="0.01"
                          min="0"
                          max="50"
                          className="pl-10"
                          placeholder={t(
                            "admin.tents.form.beerPricePlaceholder",
                          )}
                          {...createTentForm.register("beer_price", {
                            valueAsNumber: true,
                            setValueAs: (value) =>
                              value === "" ? null : value,
                          })}
                        />
                      </div>
                      {createTentForm.formState.errors.beer_price && (
                        <p className="mt-1 text-sm text-red-600">
                          {createTentForm.formState.errors.beer_price.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button
                      type="submit"
                      disabled={createTentForm.formState.isSubmitting}
                    >
                      {createTentForm.formState.isSubmitting
                        ? t("admin.tents.buttons.creating")
                        : t("admin.tents.buttons.createTent")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Copy className="mr-2 h-4 w-4" />
                  {t("admin.tents.copyFromFestival")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{t("admin.tents.dialog.copyTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.tents.dialog.copyDescription")}{" "}
                    {selectedFestivalData?.name}
                  </DialogDescription>
                </DialogHeader>
                <CopyTentsDialog
                  form={copyTentsForm}
                  festivals={festivals.filter((f) => f.id !== selectedFestival)}
                  onSubmit={handleCopyTents}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Festival Tents List */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t("admin.tents.sections.tentsIn", {
                  name: selectedFestivalData?.name,
                })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-4 text-center">
                  {t("admin.tents.loading")}
                </div>
              ) : festivalTents.length === 0 ? (
                <div className="py-8 text-center">
                  <Tent className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <h3 className="mb-2 text-lg font-semibold">
                    {t("admin.tents.empty.noTents")}
                  </h3>
                  <p className="mb-4 text-gray-600">
                    {t("admin.tents.empty.noTentsDescription")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {festivalTents.map((tent) => (
                    <TentCard
                      key={tent.id}
                      tent={tent}
                      festivalDefaultPrice={
                        selectedFestivalData?.beer_cost || 16.2
                      }
                      onUpdatePrice={(price) =>
                        handleUpdatePrice(tent.id, price)
                      }
                      onRemove={() => handleRemoveTent(tent.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Tents */}
          {availableTents.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {t("admin.tents.sections.availableTents")}
                    </CardTitle>
                    <p className="text-muted-foreground text-sm">
                      {t("admin.tents.sections.availableTentsDescription")}
                    </p>
                  </div>
                  <Button
                    onClick={handleAddAllAvailableTents}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t("admin.tents.buttons.addAll", {
                      count: availableTents.length,
                    })}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableTents.map((tent) => (
                    <div
                      key={tent.id}
                      className="space-y-2 rounded-lg border p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{tent.name}</h4>
                          {tent.category && (
                            <Badge
                              variant={getCategoryBadgeVariant(tent.category)}
                            >
                              {tent.category}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddExistingTent(tent.id)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Tent Card Component
function TentCard({
  tent,
  festivalDefaultPrice,
  onUpdatePrice,
  onRemove,
}: {
  tent: TentWithPrice;
  festivalDefaultPrice: number;
  onUpdatePrice: (price: number | null) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editPrice, setEditPrice] = useState(tent.beer_price?.toString() || "");

  const handleSavePrice = () => {
    const price = editPrice === "" ? null : parseFloat(editPrice);
    if (price !== null && (isNaN(price) || price <= 0 || price > 50)) {
      toast.error(t("notifications.error.invalidPrice"));
      return;
    }
    onUpdatePrice(price);
    setIsEditing(false);
  };

  const effectivePrice = tent.beer_price || festivalDefaultPrice;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h4 className="font-medium">{tent.name}</h4>
          {tent.category && <Badge variant="secondary">{tent.category}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {t("attendance.price")}:
          </span>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Euro className="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 transform text-gray-400" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="50"
                  className="h-8 w-24 pl-6 text-sm"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder={t("admin.tents.badges.default")}
                />
              </div>
              <Button size="sm" onClick={handleSavePrice}>
                {t("admin.tents.buttons.save")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                {t("admin.tents.buttons.cancel")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">€{effectivePrice.toFixed(2)}</span>
              {tent.beer_price === null && (
                <Badge variant="outline">
                  {t("admin.tents.badges.default")}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Copy Tents Dialog Component
function CopyTentsDialog({
  form,
  festivals,
  onSubmit,
}: {
  form: ReturnType<typeof useForm<AdminCopyTentsForm>>;
  festivals: Festival[];
  onSubmit: (data: AdminCopyTentsForm) => void;
}) {
  const { t } = useTranslation();
  const [sourceTents, setSourceTents] = useState<TentWithPrice[]>([]);
  const [selectedTents, setSelectedTents] = useState<string[]>([]);

  const sourceFestivalId = form.watch("sourceFestivalId");

  const loadSourceTents = useCallback(async () => {
    if (!sourceFestivalId) return;

    try {
      const tents = await getFestivalTents(sourceFestivalId);
      startTransition(() => {
        setSourceTents(tents);
        setSelectedTents([]);
      });
    } catch {
      toast.error(t("notifications.error.tentSourceLoadFailed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFestivalId]);

  useEffect(() => {
    if (sourceFestivalId) {
      loadSourceTents();
    }
  }, [sourceFestivalId, loadSourceTents]);

  const handleSubmit = (data: AdminCopyTentsForm) => {
    onSubmit({
      ...data,
      tentIds: selectedTents,
    });
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <Label>{t("admin.tents.dialog.sourceFestival")}</Label>
        <Select
          value={sourceFestivalId}
          onValueChange={(value) => form.setValue("sourceFestivalId", value)}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={t("admin.tents.dialog.sourceFestivalPlaceholder")}
            />
          </SelectTrigger>
          <SelectContent>
            {festivals.map((festival) => (
              <SelectItem key={festival.id} value={festival.id}>
                {festival.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sourceTents.length > 0 && (
        <div>
          <Label>{t("admin.tents.dialog.selectTentsToCopy")}</Label>
          <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border p-3">
            {sourceTents.map((tent) => (
              <div key={tent.id} className="flex items-center space-x-2">
                <Checkbox
                  id={tent.id}
                  checked={selectedTents.includes(tent.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTents([...selectedTents, tent.id]);
                    } else {
                      setSelectedTents(
                        selectedTents.filter((id) => id !== tent.id),
                      );
                    }
                  }}
                />
                <label htmlFor={tent.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span>{tent.name}</span>
                    <div className="flex items-center gap-2">
                      {tent.category && (
                        <Badge variant="outline" className="text-xs">
                          {tent.category}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-sm">
                        {formatPrice(tent.beer_price)}
                      </span>
                    </div>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="copyPrices"
          checked={form.watch("copyPrices")}
          onCheckedChange={(checked) =>
            form.setValue(
              "copyPrices",
              checked === "indeterminate" ? false : checked,
            )
          }
        />
        <Label htmlFor="copyPrices">
          {t("admin.tents.dialog.copyTentPrices")}
        </Label>
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={selectedTents.length === 0 || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? t("admin.tents.buttons.copying")
            : t("admin.tents.buttons.copyTents", {
                count: selectedTents.length,
              })}
        </Button>
      </DialogFooter>
    </form>
  );
}

function formatPrice(price: number | null): string {
  // Note: This function is used inside CopyTentsDialog which has access to t()
  if (price === null) return "Default";
  return `€${price.toFixed(2)}`;
}
