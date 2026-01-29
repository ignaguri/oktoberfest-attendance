"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCallback } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logger } from "@/lib/logger";

import { convertAndUpdateImage, listNonWebPImages } from "../actions";

interface ImageInfo {
  path: string;
  url: string;
}

export function ImageConversion() {
  const { t } = useTranslation();
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [converting, setConverting] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    try {
      const imageList = await listNonWebPImages();
      setImages(imageList);
    } catch {
      toast.error(t("notifications.error.imageLoadFailed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  async function handleConvert(path: string) {
    setConverting(path);
    try {
      await convertAndUpdateImage(path);
      await fetchImages(); // Refresh the list
      toast.success(t("notifications.success.imageConverted"));
    } catch (error) {
      logger.error(
        "Error converting image",
        logger.clientComponent("ImageConversion", { path }),
        error as Error,
      );
      toast.error(t("notifications.error.imageConvertFailed"));
    } finally {
      setConverting(null);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{t("admin.images.title")}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.images.headers.image")}</TableHead>
            <TableHead>{t("admin.images.headers.path")}</TableHead>
            <TableHead>{t("admin.images.headers.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {images.map((image) => (
            <TableRow key={image.path}>
              <TableCell>
                <Image
                  src={image.url}
                  alt={image.path}
                  className="object-cover"
                  width={64}
                  height={64}
                />
              </TableCell>
              <TableCell>{image.path}</TableCell>
              <TableCell>
                <Button
                  onClick={() => handleConvert(image.path)}
                  disabled={converting === image.path}
                >
                  {converting === image.path
                    ? t("admin.images.buttons.converting")
                    : t("admin.images.buttons.convert")}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ImageConversion;
