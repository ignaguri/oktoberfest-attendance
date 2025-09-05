"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useCallback } from "react";

import { listNonWebPImages, convertAndUpdateImage } from "../actions";

interface ImageInfo {
  path: string;
  url: string;
}

export function ImageConversion() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [converting, setConverting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchImages = useCallback(async () => {
    try {
      const imageList = await listNonWebPImages();
      setImages(imageList);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch images. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  async function handleConvert(path: string) {
    setConverting(path);
    try {
      await convertAndUpdateImage(path);
      await fetchImages(); // Refresh the list
      toast({
        title: "Success",
        description: "Image converted successfully.",
        variant: "default",
      });
    } catch (error) {
      logger.error(
        "Error converting image",
        logger.clientComponent("ImageConversion", { path }),
        error as Error,
      );
      toast({
        title: "Error",
        description: "Failed to convert image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConverting(null);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Non-WebP Images</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Image</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Action</TableHead>
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
                  {converting === image.path ? "Converting..." : "Convert"}
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
