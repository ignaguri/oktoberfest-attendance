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
import { CheckCircle, Users, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface SuccessPageProps {
  searchParams: {
    group?: string;
    group_id?: string;
  };
}

export default function JoinGroupSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const router = useRouter();
  const { group, group_id } = searchParams;
  const [isNavigating, setIsNavigating] = useState(false);

  const handleNavigation = (path: string) => {
    setIsNavigating(true);
    try {
      router.push(path);
    } catch (error) {
      toast.error("Error navigating to page");
      setIsNavigating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Welcome to the Group!
            </CardTitle>
            <CardDescription className="text-gray-600">
              You have successfully joined &quot;{group || "the group"}&quot;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                You are now a member of this group and can participate in all
                group activities, view the leaderboard, and contribute to group
                achievements.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                variant="default"
                className="w-full justify-center"
                onClick={() => handleNavigation(`/groups/${group_id}`)}
                disabled={isNavigating}
              >
                <Users className="w-4 h-4 mr-2" />
                {isNavigating ? "Loading..." : "View Group"}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => handleNavigation("/groups")}
                disabled={isNavigating}
              >
                <Users className="w-4 h-4 mr-2" />
                View All Groups
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center"
                onClick={() => handleNavigation("/home")}
                disabled={isNavigating}
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>🎉 Happy festival season!</p>
              <p>
                Remember to log your daily attendance and enjoy the competition!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
