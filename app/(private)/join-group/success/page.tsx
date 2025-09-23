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
import { useRouter, useSearchParams } from "next/navigation";

export default function JoinGroupSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const group = searchParams.get("group");
  const group_id = searchParams.get("group_id");

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <div className="flex items-center justify-center">
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
          <CardContent className="flex flex-col gap-6">
            <Alert variant="success">
              <AlertDescription>
                You are now a member of this group and can participate in all
                group activities, view the leaderboard, and contribute to group
                achievements.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center gap-3">
              <Button
                variant="darkYellow"
                className="w-fit justify-center"
                onClick={() => handleNavigation(`/groups/${group_id}`)}
              >
                <Users className="size-4 mr-2" />
                View Group
              </Button>

              <Button
                variant="outline"
                className="w-fit justify-center"
                onClick={() => handleNavigation("/groups")}
              >
                <Users className="size-4 mr-2" />
                View All Groups
              </Button>

              <Button
                variant="outline"
                className="w-fit justify-center"
                onClick={() => handleNavigation("/home")}
              >
                <Home className="size-4 mr-2" />
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
