"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { format } from "date-fns";
import { AlertCircle, Clock, Users, Home, RefreshCw, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinGroupErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const group = searchParams.get("group");
  const group_id = searchParams.get("group_id");
  const expired_at = searchParams.get("expired_at");

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const getErrorContent = () => {
    switch (type) {
      case "expired":
        return {
          icon: Clock,
          title: t("joinGroup.error.expired.title"),
          description: t("joinGroup.error.expired.message", { group }),
          message: expired_at
            ? t("joinGroup.error.expired.expiredOn", {
                date: format(new Date(expired_at), "PPP p"),
              })
            : t("joinGroup.error.expired.noLongerValid"),
          actions: [
            {
              label: t("joinGroup.error.goToGroups"),
              variant: "default" as const,
              path: "/groups",
              icon: Users,
            },
            {
              label: t("joinGroup.error.goHome"),
              variant: "outline" as const,
              path: "/home",
              icon: Home,
            },
          ],
        };
      case "already_member":
        return {
          icon: Users,
          title: t("joinGroup.error.alreadyMember.title"),
          description: t("joinGroup.error.alreadyMember.message", { group }),
          message: t("joinGroup.error.alreadyMember.noNeed"),
          actions: [
            {
              label: t("joinGroup.error.viewGroup"),
              variant: "default" as const,
              path: `/groups/${group_id}`,
              icon: Users,
            },
            {
              label: t("joinGroup.error.goToGroups"),
              variant: "outline" as const,
              path: "/groups",
              icon: Users,
            },
          ],
        };
      case "invalid":
        return {
          icon: AlertCircle,
          title: t("joinGroup.error.invalid.title"),
          description: t("joinGroup.error.invalid.message"),
          message: t("joinGroup.error.invalid.detailedMessage"),
          actions: [
            {
              label: t("joinGroup.error.goToGroups"),
              variant: "default" as const,
              path: "/groups",
              icon: Users,
            },
            {
              label: t("joinGroup.error.goHome"),
              variant: "outline" as const,
              path: "/home",
              icon: Home,
            },
          ],
        };
      default:
        return {
          icon: AlertCircle,
          title: t("joinGroup.error.generic.title"),
          description: t("joinGroup.error.generic.message"),
          message: t("joinGroup.error.generic.tryAgainMessage"),
          actions: [
            {
              label: t("joinGroup.error.tryAgain"),
              variant: "default" as const,
              path: "back",
              icon: RefreshCw,
            },
            {
              label: t("joinGroup.error.goToGroups"),
              variant: "outline" as const,
              path: "/groups",
              icon: Users,
            },
          ],
        };
    }
  };

  const errorContent = getErrorContent();
  const Icon = errorContent.icon;

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <Icon className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {errorContent.title}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {errorContent.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorContent.message}</AlertDescription>
            </Alert>

            <div className="flex flex-col items-center gap-3">
              {errorContent.actions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={index}
                    variant={
                      action.variant === "default" ? "darkYellow" : "outline"
                    }
                    className="w-fit justify-center"
                    onClick={() => {
                      if (action.path === "back") {
                        window.history.back();
                      } else {
                        handleNavigation(action.path);
                      }
                    }}
                  >
                    <IconComponent className="mr-2 size-4" />
                    {action.label}
                  </Button>
                );
              })}
            </div>

            {type === "expired" && (
              <div className="flex flex-col gap-3">
                <Alert variant="warning">
                  <AlertTitle className="flex items-center justify-center gap-2">
                    <Info className="size-4" />
                    <span>{t("joinGroup.error.expired.needNew")}</span>
                  </AlertTitle>
                  <AlertDescription>
                    {t("joinGroup.error.expired.askMember")}{" "}
                    {t("joinGroup.error.expired.hint")}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {type === "invalid" && (
              <Alert variant="destructive">
                <AlertTitle className="flex items-center justify-center gap-2">
                  <AlertCircle className="size-4" />
                  <span>{t("joinGroup.error.invalid.possibleReasons")}</span>
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 flex flex-col items-start gap-1 text-left">
                    <li>• {t("joinGroup.error.invalid.reasons.incorrect")}</li>
                    <li>• {t("joinGroup.error.invalid.reasons.deleted")}</li>
                    <li>• {t("joinGroup.error.invalid.reasons.revoked")}</li>
                    <li>• {t("joinGroup.error.invalid.reasons.expired")}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
