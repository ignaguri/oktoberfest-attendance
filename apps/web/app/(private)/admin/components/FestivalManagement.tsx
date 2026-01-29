"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { format, parseISO } from "date-fns";
import { Calendar, Edit, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Festival, FestivalStatus, FestivalType } from "@/lib/types";

import {
  createFestival,
  deleteFestival,
  fetchAllFestivals,
  updateFestival,
} from "../festivalActions";

interface FestivalFormData {
  name: string;
  short_name: string;
  festival_type: FestivalType;
  location: string;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string;
  map_url: string;
  timezone: string;
  is_active: boolean;
  status: FestivalStatus;
  description: string;
}

const initialFormData: FestivalFormData = {
  name: "",
  short_name: "",
  festival_type: "oktoberfest",
  location: "Munich, Germany",
  latitude: null,
  longitude: null,
  start_date: "",
  end_date: "",
  map_url: "https://wiesnmap.muenchen.de/",
  timezone: "Europe/Berlin",
  is_active: false,
  status: "upcoming",
  description: "",
};

export default function FestivalManagement() {
  const { t } = useTranslation();
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFestival, setEditingFestival] = useState<Festival | null>(null);
  const [formData, setFormData] = useState<FestivalFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadFestivals();
  }, []);

  const loadFestivals = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllFestivals();
      setFestivals(data);
    } catch {
      toast.error(t("notifications.error.festivalLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingFestival) {
        await updateFestival(editingFestival.id, formData);
        toast.success(t("notifications.success.festivalUpdated"));
      } else {
        await createFestival(formData);
        toast.success(t("notifications.success.festivalCreated"));
      }

      setIsFormOpen(false);
      setEditingFestival(null);
      setFormData(initialFormData);
      loadFestivals();
    } catch {
      toast.error(t("notifications.error.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (festival: Festival) => {
    setEditingFestival(festival);
    setFormData({
      name: festival.name,
      short_name: festival.short_name,
      festival_type: festival.festival_type,
      location: festival.location,
      latitude: festival.latitude ?? null,
      longitude: festival.longitude ?? null,
      start_date: festival.start_date,
      end_date: festival.end_date,
      map_url: festival.map_url || "",
      timezone: festival.timezone,
      is_active: festival.is_active,
      status: festival.status,
      description: festival.description || "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (festivalId: string, festivalName: string) => {
    if (
      !confirm(
        `${t("admin.festivals.confirmDelete")} "${festivalName}"? ${t("common.actions.cannotUndo")}`,
      )
    ) {
      return;
    }

    try {
      await deleteFestival(festivalId);
      toast.success(t("notifications.success.festivalDeleted"));
      loadFestivals();
    } catch {
      toast.error(t("notifications.error.festivalDeleteFailed"));
    }
  };

  const handleNewFestival = () => {
    setEditingFestival(null);
    setFormData(initialFormData);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingFestival(null);
    setFormData(initialFormData);
  };

  const getFestivalStatusColor = (status: FestivalStatus) => {
    switch (status) {
      case "active":
        return "text-green-600";
      case "upcoming":
        return "text-blue-600";
      case "ended":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center">{t("admin.festivals.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.festivals.title")}</h2>
        <Button onClick={handleNewFestival} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("admin.festivals.newFestival")}
        </Button>
      </div>

      {/* Festival Form */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingFestival
                ? t("admin.festivals.editFestival")
                : t("admin.festivals.createFestival")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">{t("admin.festivals.form.name")}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("admin.festivals.form.namePlaceholder")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="short_name">
                    {t("admin.festivals.form.shortName")}
                  </Label>
                  <Input
                    id="short_name"
                    value={formData.short_name}
                    onChange={(e) =>
                      setFormData({ ...formData, short_name: e.target.value })
                    }
                    placeholder={t("admin.festivals.form.shortNamePlaceholder")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="festival_type">
                    {t("admin.festivals.form.type")}
                  </Label>
                  <Select
                    value={formData.festival_type}
                    onValueChange={(value: FestivalType) =>
                      setFormData({ ...formData, festival_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oktoberfest">
                        {t("admin.festivals.types.oktoberfest")}
                      </SelectItem>
                      <SelectItem value="starkbierfest">
                        {t("admin.festivals.types.starkbierfest")}
                      </SelectItem>
                      <SelectItem value="fruehlingsfest">
                        {t("admin.festivals.types.fruhlingsfest")}
                      </SelectItem>
                      <SelectItem value="other">
                        {t("admin.festivals.types.other")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">
                    {t("admin.festivals.form.location")}
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder={t("admin.festivals.form.locationPlaceholder")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="latitude">
                    {t("admin.festivals.form.latitude")}
                  </Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.0001"
                    value={formData.latitude?.toString() ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        latitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder={t("admin.festivals.form.latitudePlaceholder")}
                  />
                </div>

                <div>
                  <Label htmlFor="longitude">
                    {t("admin.festivals.form.longitude")}
                  </Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.0001"
                    value={formData.longitude?.toString() ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder={t("admin.festivals.form.longitudePlaceholder")}
                  />
                </div>

                <div>
                  <Label htmlFor="start_date">
                    {t("admin.festivals.form.startDate")}
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_date">
                    {t("admin.festivals.form.endDate")}
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="map_url">
                    {t("admin.festivals.form.mapUrl")}
                  </Label>
                  <Input
                    id="map_url"
                    type="url"
                    value={formData.map_url}
                    onChange={(e) =>
                      setFormData({ ...formData, map_url: e.target.value })
                    }
                    placeholder={t("admin.festivals.form.mapUrlPlaceholder")}
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">
                    {t("admin.festivals.form.timezone")}
                  </Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) =>
                      setFormData({ ...formData, timezone: e.target.value })
                    }
                    placeholder={t("admin.festivals.form.timezonePlaceholder")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">
                    {t("admin.festivals.form.status")}
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: FestivalStatus) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">
                        {t("admin.festivals.statuses.upcoming")}
                      </SelectItem>
                      <SelectItem value="active">
                        {t("admin.festivals.statuses.active")}
                      </SelectItem>
                      <SelectItem value="ended">
                        {t("admin.festivals.statuses.ended")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                  <Label htmlFor="is_active">
                    {t("admin.festivals.form.markActive")}
                  </Label>
                </div>
              </div>

              <div>
                <Label htmlFor="description">
                  {t("admin.festivals.form.description")}
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder={t("admin.festivals.form.descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t("admin.festivals.buttons.saving")
                    : editingFestival
                      ? t("admin.festivals.buttons.updateFestival")
                      : t("admin.festivals.buttons.createFestival")}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t("admin.festivals.buttons.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Festivals List */}
      <div className="grid gap-4">
        {festivals.map((festival) => (
          <Card key={festival.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{festival.name}</h3>
                    <span
                      className={`text-sm font-medium capitalize ${getFestivalStatusColor(festival.status)}`}
                    >
                      {festival.status}
                    </span>
                    {festival.is_active && (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                        {t("admin.festivals.badges.active")}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(parseISO(festival.start_date), "MMM d, yyyy")} -{" "}
                        {format(parseISO(festival.end_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div>{festival.location}</div>
                    <div className="capitalize">
                      {festival.festival_type.replace("_", " ")}
                    </div>
                    {festival.description && (
                      <div className="mt-2 text-gray-500">
                        {festival.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(festival)}
                    className="flex items-center gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    {t("admin.festivals.buttons.edit")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(festival.id, festival.name)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t("admin.festivals.buttons.delete")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {festivals.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">{t("admin.festivals.empty")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
