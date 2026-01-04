// Type declarations for image and SVG imports from public directory

declare module "@/public/*.png" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "@/public/*.jpg" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "@/public/*.jpeg" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "@/public/*.webp" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "@/public/*.svg" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "@/public/icons/*.svg" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}
