"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { User, UserCheck, Image as ImageIcon, Edit } from "lucide-react";
import { Link } from "next-view-transitions";

import type { ReactNode } from "react";
import type { FC } from "react";

interface MissingFieldProps {
  label: string;
  icon: ReactNode;
  link: string;
}

const MissingField: FC<MissingFieldProps> = ({ label, icon, link }) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2 justify-center items-center">
        <span className="text-xl" role="img" aria-label={label}>
          {icon}
        </span>
        <span className="grow text-gray-700">{label}</span>
      </div>
      <Button asChild variant="ghost">
        <Link href={link} aria-label="Edit">
          <Edit className="w-4 h-4" />
        </Link>
      </Button>
    </div>
  );
};

export default function MissingFields() {
  const { data, loading } = useQuery(
    ["profile", "missing-fields"],
    () => apiClient.profile.getMissingFields(),
    { staleTime: 5 * 60 * 1000 }, // 5 minutes
  );

  // Don't render anything while loading or if no missing fields
  if (loading || !data?.hasMissingFields) {
    return null;
  }

  const { missingFields } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Your Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {missingFields.full_name && (
            <MissingField
              label="Name"
              icon={<User className="w-4 h-4" />}
              link="/profile"
            />
          )}
          {missingFields.username && (
            <MissingField
              label="Username"
              icon={<UserCheck className="w-4 h-4" />}
              link="/profile"
            />
          )}
          {missingFields.avatar_url && (
            <MissingField
              label="Profile picture"
              icon={<ImageIcon className="w-4 h-4" />}
              link="/profile"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
