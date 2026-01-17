"use client";

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
import { useTranslation } from "@/lib/i18n/client";
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
        `Are you sure you want to delete "${festivalName}"? This action cannot be undone.`,
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
          <p className="text-center">Loading festivals...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Festival Management</h2>
        <Button onClick={handleNewFestival} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Festival
        </Button>
      </div>

      {/* Festival Form */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingFestival ? "Edit Festival" : "Create New Festival"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Festival Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Oktoberfest 2025"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="short_name">Short Name</Label>
                  <Input
                    id="short_name"
                    value={formData.short_name}
                    onChange={(e) =>
                      setFormData({ ...formData, short_name: e.target.value })
                    }
                    placeholder="oktoberfest-2025"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="festival_type">Festival Type</Label>
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
                      <SelectItem value="oktoberfest">Oktoberfest</SelectItem>
                      <SelectItem value="starkbierfest">
                        Starkbierfest
                      </SelectItem>
                      <SelectItem value="fruehlingsfest">
                        Frühlingsfest
                      </SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    placeholder="Munich, Germany"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="start_date">Start Date</Label>
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
                  <Label htmlFor="end_date">End Date</Label>
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
                  <Label htmlFor="map_url">Map URL</Label>
                  <Input
                    id="map_url"
                    type="url"
                    value={formData.map_url}
                    onChange={(e) =>
                      setFormData({ ...formData, map_url: e.target.value })
                    }
                    placeholder="https://wiesnmap.muenchen.de/"
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) =>
                      setFormData({ ...formData, timezone: e.target.value })
                    }
                    placeholder="Europe/Berlin"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
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
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="ended">Ended</SelectItem>
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
                  <Label htmlFor="is_active">Mark as Active Festival</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional festival description..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Saving..."
                    : editingFestival
                      ? "Update Festival"
                      : "Create Festival"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
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
                        Active
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
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(festival.id, festival.name)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {festivals.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">
                No festivals found. Create your first festival!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
