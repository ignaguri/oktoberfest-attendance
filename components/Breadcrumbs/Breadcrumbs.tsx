"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

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

interface BreadcrumbSegment {
  href: string;
  title: string;
  isLast: boolean;
  isLoading: boolean;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);

  useEffect(() => {
    async function fetchGroupNames() {
      const segments = pathname.split("/").filter((segment) => segment !== "");
      const newBreadcrumbs: BreadcrumbSegment[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const href = `/${segments.slice(0, i + 1).join("/")}`;
        let title = formatSegmentName(segment);
        const isLast = i === segments.length - 1;

        if (isUUID(segment)) {
          newBreadcrumbs.push({
            href,
            title: "Loading...",
            isLast,
            isLoading: true,
          });
          try {
            const name = await getGroupName(segment);
            newBreadcrumbs[newBreadcrumbs.length - 1] = {
              href,
              title: name ?? "Unknown Group",
              isLast,
              isLoading: false,
            };
          } catch (error) {
            console.error(`Failed to fetch group name for ${segment}:`, error);
            newBreadcrumbs[newBreadcrumbs.length - 1] = {
              href,
              title: "Unknown Group",
              isLast,
              isLoading: false,
            };
          }
        } else {
          newBreadcrumbs.push({ href, title, isLast, isLoading: false });
        }
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

      setBreadcrumbs(newBreadcrumbs);
    }

    fetchGroupNames();
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
        {breadcrumbs.map(({ href, title, isLast, isLoading }, index) => (
          <BreadcrumbItem key={href}>
            {isLast ? (
              <BreadcrumbPage>
                {isLoading ? "Loading..." : title}
              </BreadcrumbPage>
            ) : (
              <>
                <BreadcrumbLink asChild>
                  <Link href={href}>{isLoading ? "Loading..." : title}</Link>
                </BreadcrumbLink>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
