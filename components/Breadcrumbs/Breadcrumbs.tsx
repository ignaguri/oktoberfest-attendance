"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getGroupName } from "./actions";

function isUUID(str: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function formatSegmentName(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [groupName, setGroupName] = useState<string | null>(null);

  const segments = pathname.split("/").filter((segment) => segment !== "");

  useEffect(() => {
    async function fetchGroupName() {
      if (segments.length > 0 && isUUID(segments[segments.length - 1])) {
        const uuid = segments[segments.length - 1];
        try {
          const name = await getGroupName(uuid);
          setGroupName(name);
        } catch (error) {
          console.error("Failed to fetch group name:", error);
        }
      }
    }

    fetchGroupName();
  }, [segments]);

  if (segments.length === 0) return null;

  const breadcrumbs = segments
    .filter((segment) => !segment.startsWith("("))
    .map((segment, index, array) => {
      const href = `/${array.slice(0, index + 1).join("/")}`;
      let title = formatSegmentName(segment);
      const isLast = index === array.length - 1;

      if (isLast && isUUID(segment) && groupName) {
        title = groupName;
      }

      return { href, title, isLast };
    });

  // Remove the first breadcrumb if it's "Home"
  if (breadcrumbs.length > 0 && breadcrumbs[0].title.toLowerCase() === "home") {
    breadcrumbs.shift();
  }

  // If there are no breadcrumbs left after filtering, return null
  if (breadcrumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {breadcrumbs.map(({ href, title, isLast }, index) => (
          <BreadcrumbItem key={href}>
            {isLast ? (
              <BreadcrumbPage>{title}</BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
