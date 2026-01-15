"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { CheckCircle, Users, Home } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinGroupSuccessPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const group = searchParams.get("group");
  const group_id = searchParams.get("group_id");

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {t("joinGroup.success.title")}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {t("joinGroup.success.message")} &quot;{group || "the group"}
              &quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Alert variant="success">
              <AlertDescription>
                {t("joinGroup.success.membershipNote")}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center gap-3">
              <Button
                variant="darkYellow"
                className="w-fit justify-center"
                onClick={() => handleNavigation(`/groups/${group_id}`)}
              >
                <Users className="mr-2 size-4" />
                {t("joinGroup.success.viewGroup")}
              </Button>

              <Button
                variant="outline"
                className="w-fit justify-center"
                onClick={() => handleNavigation("/groups")}
              >
                <Users className="mr-2 size-4" />
                {t("joinGroup.success.viewAllGroups")}
              </Button>

              <Button
                variant="outline"
                className="w-fit justify-center"
                onClick={() => handleNavigation("/home")}
              >
                <Home className="mr-2 size-4" />
                {t("joinGroup.success.goHome")}
              </Button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>{t("joinGroup.success.happyFestival")}</p>
              <p>{t("joinGroup.success.reminder")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
