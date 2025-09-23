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
import { format } from "date-fns";
import { AlertCircle, Clock, Users, Home, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface ErrorPageProps {
  searchParams: {
    type?: string;
    group?: string;
    expired_at?: string;
  };
}

export default function JoinGroupErrorPage({ searchParams }: ErrorPageProps) {
  const router = useRouter();
  const { type, group, expired_at } = searchParams;
  const [isRetrying, setIsRetrying] = useState(false);

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
              onClick: () => router.push("/groups"),
              icon: Users,
            },
            {
              label: "Go Home",
              variant: "outline" as const,
              onClick: () => router.push("/home"),
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
              onClick: () => router.push(`/groups/${group}`),
              icon: Users,
            },
            {
              label: "Go to Groups",
              variant: "outline" as const,
              onClick: () => router.push("/groups"),
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
            "This could happen if the link was incorrect, the group no longer exists, or the invitation was cancelled.",
          actions: [
            {
              label: "Go to Groups",
              variant: "default" as const,
              onClick: () => router.push("/groups"),
              icon: Users,
            },
            {
              label: "Go Home",
              variant: "outline" as const,
              onClick: () => router.push("/home"),
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
              onClick: () => router.back(),
              icon: RefreshCw,
            },
            {
              label: "Go to Groups",
              variant: "outline" as const,
              onClick: () => router.push("/groups"),
              icon: Users,
            },
          ],
        };
    }
  };

  const errorContent = getErrorContent();
  const Icon = errorContent.icon;

  const handleAction = (action: (typeof errorContent.actions)[0]) => {
    setIsRetrying(true);
    try {
      action.onClick();
    } catch (error) {
      toast.error("Error navigating to page");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Icon className="w-8 h-8 text-yellow-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {errorContent.title}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {errorContent.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorContent.message}</AlertDescription>
            </Alert>

            <div className="space-y-3">
              {errorContent.actions.map((action, index) => {
                const IconComponent = action.icon;
                return (
                  <Button
                    key={index}
                    variant={action.variant}
                    className="w-full justify-center"
                    onClick={() => handleAction(action)}
                    disabled={isRetrying}
                  >
                    <IconComponent className="w-4 h-4 mr-2" />
                    {isRetrying ? "Loading..." : action.label}
                  </Button>
                );
              })}
            </div>

            {type === "expired" && (
              <div className="text-center space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <p className="font-medium">ℹ️ Token Expiration Info</p>
                  <p>
                    Invitation links expire after 7 days for security reasons.
                  </p>
                </div>
                <div className="text-gray-500">
                  <p>Need a new invitation?</p>
                  <p>
                    Ask a group member to generate a new invite link for you.
                  </p>
                </div>
              </div>
            )}

            {type === "invalid" && (
              <div className="text-center space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <p className="font-medium">ℹ️ Possible Reasons</p>
                  <ul className="text-left mt-2 space-y-1">
                    <li>• The invitation link was incorrect or mistyped</li>
                    <li>• The group no longer exists</li>
                    <li>• The invitation was cancelled by the group admin</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
