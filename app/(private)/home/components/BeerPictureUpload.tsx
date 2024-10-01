"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadBeerPicture } from "@/lib/sharedActions";
import { Formik, Form, useFormikContext, ErrorMessage } from "formik";
import { Camera } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import * as Yup from "yup";

interface PictureFormValues {
  picture: File | null;
}

interface BeerPictureUploadProps {
  attendanceId: string | null;
}

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const validationSchema = Yup.object().shape({
  picture: Yup.mixed()
    .required("A beer picture is required")
    .test("fileSize", "File is too large (max 12MB)", (value) => {
      if (!value) return true;
      return value instanceof File && value.size <= MAX_FILE_SIZE;
    })
    .test(
      "fileType",
      "Unsupported file format (use JPEG, PNG, GIF, or WebP)",
      (value) => {
        if (!value) return true;
        return value instanceof File && VALID_FILE_TYPES.includes(value.type);
      },
    ),
});

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
    <Formik
      initialValues={{ picture: null }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ setFieldValue, isSubmitting, values, errors }) => (
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
          <ErrorMessage name="picture" component="span" className="error" />
          <PicturePreview />
          {values.picture && !errors.picture && (
            <Button type="submit" disabled={isSubmitting} variant="darkYellow">
              {isSubmitting ? "Uploading..." : "Upload picture"}
            </Button>
          )}
        </Form>
      )}
    </Formik>
  );
}
