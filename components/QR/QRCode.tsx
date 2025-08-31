"use client";

import QRCodeLib from "qrcode";
import { useEffect, useRef } from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCode({ value, size = 200, className }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCodeLib.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        },
        (error) => {
          if (error) {
            // QR code generation failed
          }
        },
      );
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}
