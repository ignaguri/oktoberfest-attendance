"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { beerPicturesSchema } from "@/lib/schemas/uploads";
import { uploadBeerPicture } from "@/lib/sharedActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { BeerPicturesFormData } from "@/lib/schemas/uploads";

interface BeerPicturesUploadProps {
  attendanceId: string | null;
  existingPictureUrls: string[];
  onPicturesUpdate: (newUrls: string[]) => void;
}

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_PICTURES = 10;

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
          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
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
  const { toast } = useToast();
  const [allPictureUrls, setAllPictureUrls] =
    useState<string[]>(existingPictureUrls);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<BeerPicturesFormData>({
    resolver: zodResolver(beerPicturesSchema),
    defaultValues: {
      pictures: [],
    },
  });

  const watchedPictures = watch("pictures");

  const onSubmit = async (data: BeerPicturesFormData) => {
    if (!data.pictures.length || !attendanceId) return;

    try {
      const newUrls: string[] = [];
      for (const picture of data.pictures) {
        const formData = new FormData();
        formData.append("picture", picture);
        formData.append("attendanceId", attendanceId);
        const result = await uploadBeerPicture(formData);
        if (result) {
          newUrls.push(result);
        }
      }
      const updatedUrls = [...allPictureUrls, ...newUrls];
      setAllPictureUrls(updatedUrls);
      onPicturesUpdate(updatedUrls);
      toast({
        variant: "success",
        title: "Success",
        description: `${newUrls.length} beer picture(s) uploaded successfully!`,
      });
      reset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload beer pictures. Please try again.",
      });
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
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id="beer-pictures-upload"
      />
      <label
        htmlFor="beer-pictures-upload"
        className={buttonVariants({ variant: "outline" })}
      >
        <div className="flex items-center gap-2">
          <Camera size={24} />
          <span>
            {allPictureUrls.length > 0 || watchedPictures.length > 0
              ? "Add more pics"
              : "Add pictures"}
          </span>
        </div>
      </label>
      <div className="flex flex-wrap gap-2 justify-center">
        {allPictureUrls.map((url, index) => (
          <PicturePreview
            key={`existing-${index}`}
            src={`/api/image/${url}?bucket=beer_pictures`}
            isUploaded
          />
        ))}
        {watchedPictures.map((file, index) => (
          <PicturePreview
            key={`new-${index}`}
            src={URL.createObjectURL(file)}
            onRemove={() => removePicture(index)}
          />
        ))}
      </div>
      {errors.pictures && (
        <span className="error">{errors.pictures.message}</span>
      )}
      {watchedPictures.length > 0 && !errors.pictures && (
        <Button type="submit" disabled={isSubmitting} variant="darkYellow">
          {isSubmitting
            ? "Uploading..."
            : `Upload ${watchedPictures.length} picture(s)`}
        </Button>
      )}
    </form>
  );
}
