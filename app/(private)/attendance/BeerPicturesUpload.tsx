"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { uploadBeerPicture } from "@/lib/actions";
import { Formik, Form, ErrorMessage, FieldArray } from "formik";
import { Camera, X } from "lucide-react";
import * as Yup from "yup";

interface PictureFormValues {
  pictures: File[];
}

interface BeerPicturesUploadProps {
  attendanceId: string | null;
  existingPictureUrls: string[];
  onPicturesUpdate: (newUrls: string[]) => void;
}

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_PICTURES = 10;

const validationSchema = Yup.object().shape({
  pictures: Yup.array()
    .of(
      Yup.mixed()
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
            return (
              value instanceof File && VALID_FILE_TYPES.includes(value.type)
            );
          },
        ),
    )
    .min(1, "At least one picture is required")
    .max(MAX_PICTURES, `Maximum ${MAX_PICTURES} pictures allowed`),
});

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
    <div className="relative w-24 h-24">
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

  const handleSubmit = async (
    values: PictureFormValues,
    { setSubmitting, resetForm }: any,
  ) => {
    if (!values.pictures.length || !attendanceId) return;

    try {
      const newUrls: string[] = [];
      for (const picture of values.pictures) {
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
      resetForm();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload beer pictures. Please try again.",
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
      initialValues={{ pictures: [] }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ setFieldValue, isSubmitting, values, errors }) => (
        <Form className="flex flex-col items-center gap-4">
          <FieldArray name="pictures">
            {({ remove }) => (
              <>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files || []);
                    const newPictures = [
                      ...values.pictures,
                      ...files.slice(
                        0,
                        MAX_PICTURES -
                          allPictureUrls.length -
                          values.pictures.length,
                      ),
                    ];
                    setFieldValue("pictures", newPictures);
                  }}
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
                      {allPictureUrls.length > 0 || values.pictures.length > 0
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
                  {values.pictures.map((file, index) => (
                    <PicturePreview
                      key={`new-${index}`}
                      src={URL.createObjectURL(file)}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
              </>
            )}
          </FieldArray>
          <ErrorMessage name="pictures" component="span" className="error" />
          {values.pictures.length > 0 && !errors.pictures && (
            <Button type="submit" disabled={isSubmitting} variant="darkYellow">
              {isSubmitting
                ? "Uploading..."
                : `Upload ${values.pictures.length} picture(s)`}
            </Button>
          )}
        </Form>
      )}
    </Formik>
  );
}
