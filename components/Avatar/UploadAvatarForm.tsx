"use client";

import React, { useState, useRef } from "react";
import { uploadAvatar } from "./actions";
import { Formik, Form, ErrorMessage, useFormikContext } from "formik";
import * as Yup from "yup";
import { useToast } from "@/hooks/use-toast";
import { AvatarPreview } from "./Avatar";
import { buttonVariants } from "@/components/ui/button";

export interface UploadAvatarFormProps {
  className?: string;
  uid: string;
  onUpload?: (url: string) => void;
}

interface FormValues {
  avatar: File | null;
}

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB
const VALID_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const validationSchema = Yup.object().shape({
  avatar: Yup.mixed()
    .required("An avatar file is required")
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

function FileInput() {
  const { setFieldValue, submitForm, errors } = useFormikContext<FormValues>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      await setFieldValue("avatar", file);
      if (!errors.avatar) {
        submitForm();
      }
    }
  };

  return (
    <>
      <label
        htmlFor="avatar-upload"
        className={buttonVariants({ variant: "outline" })}
      >
        Choose picture
      </label>
      <input
        ref={fileInputRef}
        id="avatar-upload"
        name="avatar"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <ErrorMessage name="avatar" component="span" className="error" />
    </>
  );
}

export default function UploadAvatarForm({
  className,
  uid,
  onUpload,
}: UploadAvatarFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUploadAvatar = async (
    values: FormValues,
    { setSubmitting, resetForm }: any,
  ) => {
    if (!values.avatar || !uid) return;

    const formData = new FormData();
    formData.append("avatar", values.avatar);
    formData.append("userId", uid);

    try {
      const url = await uploadAvatar(formData);
      onUpload?.(url);
      toast({
        variant: "success",
        title: "Success",
        description: "Picture uploaded successfully!",
      });
      resetForm();
      setPreviewUrl(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <Formik
        initialValues={{ avatar: null }}
        validationSchema={validationSchema}
        onSubmit={handleUploadAvatar}
      >
        {() => (
          <Form className="flex flex-col items-center gap-4">
            <AvatarPreview url={null} previewUrl={previewUrl} size="large" />
            <FileInput />
          </Form>
        )}
      </Formik>
    </div>
  );
}
