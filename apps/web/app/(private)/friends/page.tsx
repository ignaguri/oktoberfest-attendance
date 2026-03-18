"use client";

import { useFriendRequestCount } from "@prostcounter/shared/hooks";
import { Users } from "lucide-react";

import { FriendRequests } from "@/components/friends/FriendRequests";
import { FriendsList } from "@/components/friends/FriendsList";
import { FriendSuggestions } from "@/components/friends/FriendSuggestions";
import { UserSearch } from "@/components/friends/UserSearch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/client";

export default function FriendsPage() {
  const { t } = useTranslation();
  const { data: requestCount } = useFriendRequestCount();

  return (
    <div className="w-full px-2">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">{t("friends.title")}</h1>
        <UserSearch />
      </div>

      <Tabs defaultValue="friends">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="friends" className="flex-1 gap-1.5">
            <Users className="size-4" />
            {t("friends.myFriends")}
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 gap-1.5">
            {t("friends.requests")}
            {requestCount != null && requestCount > 0 && (
              <Badge
                variant="default"
                className="ml-1 h-5 min-w-5 justify-center rounded-full px-1.5 text-xs"
              >
                {requestCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <FriendSuggestions />
          <FriendsList />
        </TabsContent>

        <TabsContent value="requests">
          <FriendRequests />
        </TabsContent>
      </Tabs>
    </div>
  );
}
