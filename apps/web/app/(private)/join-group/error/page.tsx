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
import { format } from "date-fns";
import { AlertCircle, Clock, Users, Home, RefreshCw, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinGroupErrorPage() {
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
          title: "Invitation Expired",
          description: `The invitation to join "${group}" has expired.`,
          message: expired_at
            ? `This invitation expired on ${format(new Date(expired_at), "PPP p")}.`
            : "This invitation is no longer valid.",
          actions: [
            {
              label: "Go to Groups",
              variant: "default" as const,
              path: "/groups",
              icon: Users,
            },
            {
              label: "Go Home",
              variant: "outline" as const,
              path: "/home",
              icon: Home,
            },
          ],
        };
      case "already_member":
        return {
          icon: Users,
          title: "Already a Member",
          description: `You're already a member of "${group}".`,
          message:
            "You don't need to use an invitation link to access this group.",
          actions: [
            {
              label: "View Group",
              variant: "default" as const,
              path: `/groups/${group_id}`,
              icon: Users,
            },
            {
              label: "Go to Groups",
              variant: "outline" as const,
              path: "/groups",
              icon: Users,
            },
          ],
        };
      case "invalid":
        return {
          icon: AlertCircle,
          title: "Invalid Invitation",
          description: "The invitation link you used is not valid.",
          message:
            "This could happen if the link was incorrect or expired, the group no longer exists, or the invitation was cancelled.",
          actions: [
            {
              label: "Go to Groups",
              variant: "default" as const,
              path: "/groups",
              icon: Users,
            },
            {
              label: "Go Home",
              variant: "outline" as const,
              path: "/home",
              icon: Home,
            },
          ],
        };
      default:
        return {
          icon: AlertCircle,
          title: "Unable to Join Group",
          description: "Something went wrong while trying to join the group.",
          message:
            "Please try again or contact the group administrator for assistance.",
          actions: [
            {
              label: "Try Again",
              variant: "default" as const,
              path: "back",
              icon: RefreshCw,
            },
            {
              label: "Go to Groups",
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
                    <span>Need a new invitation?</span>
                  </AlertTitle>
                  <AlertDescription>
                    Ask a group member to generate a new invite link for you.
                    Invitation links expire after 7 days for security reasons.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {type === "invalid" && (
              <Alert variant="destructive">
                <AlertTitle className="flex items-center justify-center gap-2">
                  <AlertCircle className="size-4" />
                  <span>Possible Reasons</span>
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 flex flex-col items-start gap-1 text-left">
                    <li>• The invitation link was incorrect or mistyped</li>
                    <li>• The group no longer exists</li>
                    <li>• The invitation was cancelled by the group admin</li>
                    <li>• The invitation link has expired</li>
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
