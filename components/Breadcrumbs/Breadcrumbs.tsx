"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useGroupName } from "@/hooks/useGroups";
import { usePathname } from "next/navigation";
import { Link } from "next-view-transitions";
import React, { useMemo } from "react";

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

interface BreadcrumbSegment {
  href: string;
  title: string;
  isLast: boolean;
  isUUID: boolean;
  groupId?: string;
}

export default function Breadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter((segment) => segment !== "");
    const newBreadcrumbs: BreadcrumbSegment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const href = `/${segments.slice(0, i + 1).join("/")}`;
      const title = formatSegmentName(segment);
      const isLast = i === segments.length - 1;
      const isUUIDSegment = isUUID(segment);

      newBreadcrumbs.push({
        href,
        title,
        isLast,
        isUUID: isUUIDSegment,
        groupId: isUUIDSegment ? segment : undefined,
      });
    }

    // Apply the existing filtering logic
    if (newBreadcrumbs.length > 0) {
      if (newBreadcrumbs[0].title.toLowerCase() === "home") {
        newBreadcrumbs.shift();
      } else if (newBreadcrumbs[0].title.toLowerCase() === "group settings") {
        const last = newBreadcrumbs.pop();
        const secondLast = newBreadcrumbs.pop();
        if (last && secondLast) {
          last.isLast = false;
          last.href = last.href.replace("group-settings", "groups");
          newBreadcrumbs.push(last);
          secondLast.isLast = true;
          secondLast.title = "Settings";
          newBreadcrumbs.push(secondLast);
        }
      }
    }

    return newBreadcrumbs;
  }, [pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {breadcrumbs.map(({ href, title, isLast, isUUID, groupId }, index) => (
          <BreadcrumbSegment
            key={href}
            href={href}
            title={title}
            isLast={isLast}
            isUUID={isUUID}
            groupId={groupId}
            showSeparator={index < breadcrumbs.length - 1}
          />
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function BreadcrumbSegment({
  href,
  title,
  isLast,
  isUUID,
  groupId,
  showSeparator,
}: BreadcrumbSegment & { showSeparator: boolean }) {
  const { data: groupName, loading, error } = useGroupName(groupId || "");

  const displayTitle = isUUID
    ? loading
      ? "Loading..."
      : error
        ? "Unknown Group"
        : groupName || "Unknown Group"
    : title;

  return (
    <React.Fragment>
      <BreadcrumbItem>
        {isLast ? (
          <BreadcrumbPage>{displayTitle}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink asChild>
            <Link href={href}>{displayTitle}</Link>
          </BreadcrumbLink>
        )}
      </BreadcrumbItem>
      {showSeparator && <BreadcrumbSeparator />}
    </React.Fragment>
  );
}
