"use client";

import { Edit, Image as ImageIcon, User, UserCheck } from "lucide-react";
import { Link } from "next-view-transitions";
import type { ReactNode } from "react";
import type { FC } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@/lib/data/react-query-provider";
import { useTranslation } from "@/lib/i18n/client";

interface MissingFieldProps {
  label: string;
  icon: ReactNode;
  link: string;
  editLabel: string;
}

const MissingField: FC<MissingFieldProps> = ({
  label,
  icon,
  link,
  editLabel,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center justify-center gap-2">
        <span className="text-xl" role="img" aria-label={label}>
          {icon}
        </span>
        <span className="grow text-gray-700">{label}</span>
      </div>
      <Button asChild variant="ghost">
        <Link href={link} aria-label={editLabel}>
          <Edit className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
};

export default function MissingFields() {
  const { t } = useTranslation();
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
        <CardTitle>{t("home.missingFields.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {missingFields.full_name && (
            <MissingField
              label={t("home.missingFields.name")}
              icon={<User className="h-4 w-4" />}
              link="/profile"
              editLabel={t("home.missingFields.edit")}
            />
          )}
          {missingFields.username && (
            <MissingField
              label={t("home.missingFields.username")}
              icon={<UserCheck className="h-4 w-4" />}
              link="/profile"
              editLabel={t("home.missingFields.edit")}
            />
          )}
          {missingFields.avatar_url && (
            <MissingField
              label={t("home.missingFields.profilePicture")}
              icon={<ImageIcon className="h-4 w-4" />}
              link="/profile"
              editLabel={t("home.missingFields.edit")}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
