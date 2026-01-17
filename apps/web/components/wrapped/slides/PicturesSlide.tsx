"use client";

import { motion } from "framer-motion";
import { Camera, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { cn, shuffleArray } from "@/lib/utils";
import type { WrappedData } from "@/lib/wrapped/types";

/**
 * Extract file path from a full Supabase storage URL or return the path as-is
 */
function extractFilePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) {
    return urlOrPath;
  }

  try {
    const url = new URL(urlOrPath);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf("beer_pictures");
    if (bucketIndex !== -1) {
      return pathParts.slice(bucketIndex + 1).join("/");
    }
    const publicIndex = pathParts.indexOf("public");
    if (publicIndex !== -1) {
      return pathParts.slice(publicIndex + 2).join("/");
    }
    return urlOrPath;
  } catch {
    return urlOrPath;
  }
}

import {
  BaseSlide,
  SlideContent,
  SlideSubtitle,
  SlideTitle,
} from "./BaseSlide";

interface PicturesSlideProps {
  data: WrappedData;
  isActive?: boolean;
}

export function PicturesSlide({ data, isActive = false }: PicturesSlideProps) {
  const { pictures } = data.social_stats;
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  const picturesToShow = shuffleArray(pictures).slice(0, 10);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  };

  // Animation variants for photos
  const photoVariants = {
    hidden: () => ({
      opacity: 0,
      x: 0,
      y: 0,
      scale: 0.8,
      rotate: 0,
    }),
    visible: (index: number) => {
      // Calculate final scattered position
      const angle = Math.random() * 24 - 12; // -12° to +12°
      const scale = 0.85 + Math.random() * 0.3; // 0.85 to 1.15

      // Responsive positioning based on screen size
      const baseSpread = isMobile ? 120 : 200;
      const spread = baseSpread + index * 10;

      const translateX = (Math.random() - 0.5) * spread;
      const translateY = (Math.random() - 0.5) * spread * 0.7;

      return {
        opacity: 1,
        x: translateX,
        y: translateY,
        scale: scale,
        rotate: angle + "deg",
        transition: {
          duration: 0.8,
          delay: index * 0.15,
          scale: {
            type: "spring",
            stiffness: 100,
            damping: 15,
          },
        },
      };
    },
    hover: {
      scale: 1.1,
      brightness: 1.1,
      transition: { duration: 0.3 },
    },
  };

  return (
    <BaseSlide
      isActive={isActive}
      className="bg-gradient-to-br from-green-50 to-emerald-50"
    >
      <SlideTitle>Your festival memories</SlideTitle>
      <SlideSubtitle>Your captured moments</SlideSubtitle>

      <SlideContent className="flex flex-col items-center justify-center">
        {pictures.length > 0 ? (
          <div className="w-full max-w-4xl">
            <div className="mb-6 flex items-center justify-center gap-2 text-lg text-gray-700">
              <Camera className="size-5" />
              <span>You captured {pictures.length} moments</span>
            </div>

            <div className="relative h-96 w-full sm:h-[28rem] md:h-[32rem]">
              {/* Photo scattering container - centered below the text */}
              <div className="absolute left-1/4 top-1/4 size-64 -translate-x-1/2 -translate-y-1/2 sm:size-80 md:size-96">
                {picturesToShow.map((picture, index) => {
                  const isLoaded = loadedImages.has(picture.id);
                  const filePath = extractFilePath(picture.picture_url);
                  const imageUrl = `/api/image/${encodeURIComponent(filePath)}?bucket=beer_pictures`;

                  return (
                    <motion.div
                      key={picture.id}
                      className="group absolute size-48 sm:size-56 md:size-64"
                      style={{
                        left: "50%",
                        top: "50%",
                        zIndex: index + 10,
                      }}
                      custom={index}
                      variants={photoVariants}
                      initial="hidden"
                      animate="visible"
                      whileHover="hover"
                    >
                      {/* Skeleton placeholder while loading */}
                      {!isLoaded && (
                        <motion.div
                          className="absolute inset-0 rounded-lg"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}

                      <div className="relative h-full w-full overflow-hidden rounded-lg">
                        <Image
                          src={imageUrl}
                          alt={`Festival photo from ${new Date(picture.attendance_date).toLocaleDateString()}`}
                          fill
                          className={cn(
                            "transform-gpu rounded-lg object-cover transition-all duration-300 will-change-transform",
                            isLoaded ? "opacity-100" : "opacity-0",
                          )}
                          loading="lazy"
                          sizes="200px"
                          onLoad={() => handleImageLoad(picture.id)}
                          unoptimized
                        />

                        {/* Subtle shadow overlay */}
                        <div className="bg-black/1 absolute inset-0 rounded-lg" />

                        {/* Hover overlay with date */}
                        <motion.div
                          className="absolute inset-0 rounded-lg"
                          initial={{ backgroundColor: "rgba(0, 0, 0, 0)" }}
                          whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
                          transition={{ duration: 0.3 }}
                        />
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 p-3"
                          initial={{
                            background:
                              "linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.2), transparent)",
                            opacity: 0,
                          }}
                          whileHover={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          <p className="text-xs font-medium text-white">
                            {new Date(
                              picture.attendance_date,
                            ).toLocaleDateString()}
                          </p>
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Doesn't make sense to show this, since the user can't see the rest
            {pictures.length > 15 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  And {pictures.length - 15} more memories captured...
                </p>
              </div>
            )} */}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-gray-100 p-6">
              <ImageIcon className="size-12 text-gray-400" />
            </div>
            <p className="mb-2 text-lg font-medium text-gray-700">
              No photos captured this festival
            </p>
            <p className="text-gray-500">
              Next time, remember to snap some pictures of your festival
              adventures!
            </p>
          </div>
        )}
      </SlideContent>
    </BaseSlide>
  );
}
