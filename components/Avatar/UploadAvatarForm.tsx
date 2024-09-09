"use client";

import React, { useState } from "react";
import { uploadAvatar } from "./actions";
import { Formik, Form, ErrorMessage } from "formik";
import * as Yup from "yup";
import { AvatarPreview } from "./Avatar";

export interface UploadAvatarFormProps {
  className?: string;
  uid: string;
  onUpload?: (url: string) => void;
}

interface FormValues {
  avatar: File | null;
}

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

const validationSchema = Yup.object().shape({
  avatar: Yup.mixed()
    .required("An avatar file is required")
    .test("fileSize", "File is too large (max 1MB)", (value) => {
      if (!value) return true;
      return value instanceof File && value.size <= MAX_FILE_SIZE;
    })
    .test(
      "fileType",
      "Unsupported file format (use JPEG, PNG, or GIF)",
      (value) => {
        if (!value) return true;
        return (
          value instanceof File &&
          ["image/jpeg", "image/png", "image/gif"].includes(value.type)
        );
      },
    ),
});

export default function UploadAvatarForm({
  className,
  uid,
  onUpload,
}: UploadAvatarFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setFieldValue: (field: string, value: any) => void,
  ) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setFieldValue("avatar", file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async (
    values: FormValues,
    { setSubmitting, setFieldError, resetForm }: any,
  ) => {
    if (!values.avatar || !uid) return;

    const formData = new FormData();
    formData.append("avatar", values.avatar);
    formData.append("userId", uid);

    try {
      const url = await uploadAvatar(formData);
      onUpload?.(url);
      resetForm();
    } catch (error) {
      setFieldError(
        "avatar",
        error instanceof Error ? error.message : "An unknown error occurred",
      );
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
        {({ isSubmitting, setFieldValue }) => (
          <Form id="avatar-upload-form" className="flex flex-col items-center">
            <AvatarPreview url={null} previewUrl={previewUrl} size="large" />
            <ErrorMessage
              name="avatar"
              component="span"
              className="text-red-500 my-2"
            />
            <label htmlFor="avatar-upload" className="mt-2 mb-2">
              <div className="button">Choose Avatar</div>
            </label>
            <input
              id="avatar-upload"
              name="avatar"
              type="file"
              accept="image/*"
              onChange={(event) => handleFileChange(event, setFieldValue)}
              className="hidden"
            />
            <button
              type="submit"
              disabled={isSubmitting || !previewUrl}
              className="button-inverse"
            >
              Upload
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
}
