"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { MAX_FILE_SIZE, singlePictureSchema } from "@/lib/schemas/uploads";
import { uploadBeerPicture } from "@/lib/sharedActions";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import type { SinglePictureFormData } from "@/lib/schemas/uploads";

interface BeerPictureUploadProps {
  attendanceId: string | null;
}

const PicturePreview = ({ picture }: { picture: File | null }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (picture) {
      const newPreviewUrl = URL.createObjectURL(picture);
      setPreviewUrl(newPreviewUrl);
      return () => URL.revokeObjectURL(newPreviewUrl);
    }
  }, [picture]);

  if (!previewUrl) return null;

  return (
    <div className="relative w-32 h-32">
      <Image
        src={previewUrl}
        alt="Beer picture preview"
        fill
        className="rounded object-cover"
      />
    </div>
  );
};

export function BeerPictureUpload({ attendanceId }: BeerPictureUploadProps) {
  const { toast } = useToast();
  const [pictureAlreadyUploaded, setPictureAlreadyUploaded] = useState(false);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SinglePictureFormData>({
    resolver: zodResolver(singlePictureSchema),
    defaultValues: {
      visibility: "public",
    },
  });

  const watchedPicture = watch("picture");
  const watchedVisibility = watch("visibility");

  const onSubmit = async (data: SinglePictureFormData) => {
    if (!data.picture || !attendanceId) return;

    try {
      const formData = new FormData();
      formData.append("picture", data.picture);
      formData.append("attendanceId", attendanceId);
      formData.append("visibility", data.visibility);
      await uploadBeerPicture(formData);
      toast({
        variant: "success",
        title: "Success",
        description: "Beer picture uploaded successfully!",
      });
      setPictureAlreadyUploaded(true);
      reset();
    } catch (error) {
      const fileSizeError =
        error instanceof Error && error.message.includes("exceeded")
          ? `File size exceeded (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`
          : "";
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to upload beer picture${fileSizeError ? `: ${fileSizeError}` : ""}. Please try again.`,
      });
    }
  };

  if (!attendanceId) {
    return null;
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setValue("picture", file);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col items-center gap-4"
    >
      <Input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="beer-picture-upload"
        errorMsg={errors.picture?.message}
      />
      <Label
        htmlFor="beer-picture-upload"
        className={buttonVariants({ variant: "outline" })}
      >
        {watchedPicture ? (
          <span>Choose a different one</span>
        ) : (
          <div className="flex items-center gap-2">
            <Camera size={24} />
            {pictureAlreadyUploaded ? (
              <span>add another</span>
            ) : (
              <span>with a beer</span>
            )}
          </div>
        )}
      </Label>
      <PicturePreview picture={watchedPicture || null} />

      {/* Visibility Control */}
      {watchedPicture && (
        <div className="flex items-center gap-3 bg-gray-50 rounded-md">
          {watchedVisibility === "public" ? (
            <Eye size={16} className="text-green-600" />
          ) : (
            <EyeOff size={16} className="text-red-600" />
          )}
          <span className="text-sm font-medium">
            {watchedVisibility === "public" ? "Public photo" : "Private photo"}
          </span>
          <Switch
            checked={watchedVisibility === "public"}
            onCheckedChange={(checked) =>
              setValue("visibility", checked ? "public" : "private")
            }
            size="sm"
          />
        </div>
      )}

      {watchedPicture && !errors.picture && (
        <Button type="submit" disabled={isSubmitting} variant="darkYellow">
          {isSubmitting ? "Uploading..." : "Upload picture"}
        </Button>
      )}
    </form>
  );
}
