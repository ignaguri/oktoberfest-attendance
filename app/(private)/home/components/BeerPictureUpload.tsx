"use client";

import { useState, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadBeerPicture } from "@/lib/actions";
import { Formik, Form, useFormikContext } from "formik";
import { Camera } from "lucide-react";

interface PictureFormValues {
  picture: File | null;
}

interface BeerPictureUploadProps {
  attendanceId: string | null;
}

const PicturePreview = () => {
  const { values } = useFormikContext<PictureFormValues>();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (values.picture) {
      const newPreviewUrl = URL.createObjectURL(values.picture);
      setPreviewUrl(newPreviewUrl);
      return () => URL.revokeObjectURL(newPreviewUrl);
    }
  }, [values.picture]);

  if (!previewUrl) return null;

  return (
    <div className="relative w-32 h-32">
      <Image
        src={previewUrl}
        alt="Beer picture preview"
        layout="fill"
        objectFit="cover"
        className="rounded"
      />
    </div>
  );
};

export function BeerPictureUpload({ attendanceId }: BeerPictureUploadProps) {
  const { toast } = useToast();
  const [pictureAlreadyUploaded, setPictureAlreadyUploaded] = useState(false);

  const handleSubmit = async (
    values: PictureFormValues,
    { setSubmitting, resetForm }: any,
  ) => {
    if (!values.picture || !attendanceId) return;

    try {
      const formData = new FormData();
      formData.append("picture", values.picture);
      formData.append("attendanceId", attendanceId);
      await uploadBeerPicture(formData);
      toast({
        variant: "success",
        title: "Success",
        description: "Beer picture uploaded successfully!",
      });
      setPictureAlreadyUploaded(true);
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload beer picture. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!attendanceId) {
    return null;
  }

  return (
    <Formik initialValues={{ picture: null }} onSubmit={handleSubmit}>
      {({ setFieldValue, isSubmitting, values }) => (
        <Form className="flex flex-col items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                setFieldValue("picture", file);
              }
            }}
            className="hidden"
            id="beer-picture-upload"
          />
          <label
            htmlFor="beer-picture-upload"
            className={buttonVariants({ variant: "outline" })}
          >
            {values.picture ? (
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
          </label>
          <PicturePreview />
          {values.picture && (
            <Button type="submit" disabled={isSubmitting} variant="darkYellow">
              {isSubmitting ? "Uploading..." : "Upload picture"}
            </Button>
          )}
        </Form>
      )}
    </Formik>
  );
}
