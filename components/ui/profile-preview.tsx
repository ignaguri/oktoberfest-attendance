"use client";

import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Card, CardHeader, CardTitle } from "./card";
import { Dialog, DialogContent, DialogTrigger } from "./dialog";

interface ProfilePreviewProps {
  username: string;
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
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-20 h-20">
                <AvatarImage
                  src={`/api/image/${avatarUrl}` || undefined}
                  alt={username}
                />
                <AvatarFallback className="bg-yellow-100 text-yellow-800 text-2xl">
                  {username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg font-semibold">
                  {username}
                </CardTitle>
                {fullName && (
                  <p className="text-sm text-gray-600">{fullName}</p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
