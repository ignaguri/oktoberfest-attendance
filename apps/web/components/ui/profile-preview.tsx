"use client";

import { cn, getAvatarUrl } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Card, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";

interface ProfilePreviewProps {
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function ProfilePreview({
  username,
  fullName,
  avatarUrl,
  children,
  className = "",
}: ProfilePreviewProps) {
  // Show username if available, otherwise full name
  const displayName = username || fullName || "Unknown";
  const fallbackInitial = displayName.charAt(0).toUpperCase();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            "cursor-pointer transition-colors hover:text-yellow-600",
            className,
          )}
        >
          {children}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={getAvatarUrl(avatarUrl)} alt={displayName} />
                <AvatarFallback className="bg-yellow-100 text-2xl text-yellow-800">
                  {fallbackInitial}
                </AvatarFallback>
              </Avatar>
              <div>
                {username && (
                  <CardTitle className="text-lg font-semibold">
                    {username}
                  </CardTitle>
                )}
                {fullName && (
                  <p
                    className={cn(
                      "text-gray-600",
                      username
                        ? "text-sm"
                        : "text-lg font-semibold text-gray-900",
                    )}
                  >
                    {fullName}
                  </p>
                )}
                {!username && !fullName && (
                  <CardTitle className="text-lg font-semibold">
                    Unknown User
                  </CardTitle>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
