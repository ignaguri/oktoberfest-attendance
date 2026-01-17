"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Eye, EyeOff, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoPreview } from "@/components/ui/photo-preview";
import { Switch } from "@/components/ui/switch";
import { apiClient, ApiError } from "@/lib/api-client";
import { translateError, useTranslation } from "@/lib/i18n/client";
import type { BeerPicturesFormData } from "@/lib/schemas/uploads";
import { beerPicturesSchema, MAX_PICTURES } from "@/lib/schemas/uploads";

interface BeerPicturesUploadProps {
  attendanceId: string | null;
  existingPictureUrls: string[];
  onPicturesUpdate: (newUrls: string[]) => void;
}

const PicturePreview = ({
  src,
  onRemove,
  isUploaded = false,
}: {
  src: string;
  onRemove?: () => void;
  isUploaded?: boolean;
}) => {
  return (
    <div className="relative w-24">
      <Image
        src={src}
        alt="Beer picture preview"
        className="rounded object-cover"
        width={96}
        height={96}
      />
      {!isUploaded && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1"
        >
          <X size={16} className="text-white" />
        </button>
      )}
    </div>
  );
};

export function BeerPicturesUpload({
  attendanceId,
  existingPictureUrls,
  onPicturesUpdate,
}: BeerPicturesUploadProps) {
  const { t } = useTranslation();
  const [allPictureUrls, setAllPictureUrls] =
    useState<string[]>(existingPictureUrls);

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<BeerPicturesFormData>({
    resolver: zodResolver(beerPicturesSchema),
    defaultValues: {
      pictures: [],
      visibility: "public",
    },
  });

  const watchedPictures = watch("pictures");
  const watchedVisibility = watch("visibility");

  const onSubmit = async (data: BeerPicturesFormData) => {
    if (!data.pictures.length || !attendanceId) return;

    try {
      const newUrls: string[] = [];
      for (const picture of data.pictures) {
        const result = await apiClient.photos.upload({
          picture,
          attendanceId,
          visibility: data.visibility,
        });

        if (result.pictureUrl) {
          newUrls.push(result.pictureUrl);
        }
      }
      const updatedUrls = [...allPictureUrls, ...newUrls];
      setAllPictureUrls(updatedUrls);
      onPicturesUpdate(updatedUrls);
      toast.success(
        t("notifications.success.picturesUploaded", { count: newUrls.length }),
      );
      reset();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(translateError(t, error.code, error.message));
      } else {
        toast.error(t("notifications.error.generic"));
      }
    }
  };

  if (!attendanceId) {
    return null;
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files || []);
    const newPictures = [
      ...watchedPictures,
      ...files.slice(
        0,
        MAX_PICTURES - allPictureUrls.length - watchedPictures.length,
      ),
    ];
    setValue("pictures", newPictures);
  };

  const removePicture = (index: number) => {
    const newPictures = watchedPictures.filter((_, i) => i !== index);
    setValue("pictures", newPictures);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col items-center gap-4"
    >
      <Input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id="beer-pictures-upload"
        errorMsg={errors.pictures?.message}
      />
      <Label
        htmlFor="beer-pictures-upload"
        className={buttonVariants({ variant: "outline" })}
      >
        <div className="flex items-center gap-2">
          <Camera size={24} />
          <span>
            {allPictureUrls.length > 0 || watchedPictures.length > 0
              ? t("attendance.pictures.addMore")
              : t("attendance.pictures.add")}
          </span>
        </div>
      </Label>

      {/* Existing uploaded pictures with preview functionality */}
      {allPictureUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            {allPictureUrls.map((url, index) => (
              <PhotoPreview
                key={`existing-${index}`}
                urls={[url]}
                size="lg"
                maxThumbnails={1}
                className="cursor-pointer transition-transform hover:scale-105"
              />
            ))}
          </div>
          <p className="text-center text-xs text-gray-600">
            {t("attendance.pictures.clickToView")}
          </p>
        </div>
      )}

      {/* New pictures being uploaded */}
      {watchedPictures.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-gray-600">
            {t("attendance.pictures.newToUpload")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {watchedPictures.map((file, index) => (
              <PicturePreview
                key={`new-${index}`}
                src={URL.createObjectURL(file)}
                onRemove={() => removePicture(index)}
              />
            ))}
          </div>

          {/* Visibility Control for all new photos */}
          <div className="flex items-center justify-center gap-3 rounded-md bg-gray-50 p-2">
            {watchedVisibility === "public" ? (
              <Eye size={16} className="text-green-600" />
            ) : (
              <EyeOff size={16} className="text-red-600" />
            )}
            <span className="text-sm font-medium">
              {watchedVisibility === "public"
                ? t("attendance.pictures.publicPhotos")
                : t("attendance.pictures.privatePhotos")}
            </span>
            <Switch
              checked={watchedVisibility === "public"}
              onCheckedChange={(checked) =>
                setValue("visibility", checked ? "public" : "private")
              }
            />
          </div>
        </div>
      )}

      {watchedPictures.length > 0 && !errors.pictures && (
        <Button type="submit" disabled={isSubmitting} variant="darkYellow">
          {isSubmitting
            ? t("common.status.loading")
            : t("attendance.pictures.upload", {
                count: watchedPictures.length,
              })}
        </Button>
      )}
    </form>
  );
}
