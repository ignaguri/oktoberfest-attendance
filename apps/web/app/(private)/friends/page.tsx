"use client";

import { useFriendRequestCount } from "@prostcounter/shared/hooks";
import { Search, Users } from "lucide-react";

import { FriendRequests } from "@/components/friends/FriendRequests";
import { FriendsList } from "@/components/friends/FriendsList";
import { FriendSuggestions } from "@/components/friends/FriendSuggestions";
import { UserSearch } from "@/components/friends/UserSearch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/client";

export default function FriendsPage() {
  const { t } = useTranslation();
  const { data: requestCount } = useFriendRequestCount();

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">{t("friends.title")}</h1>
        <UserSearch className="w-full sm:w-72" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="friends">
            <TabsList>
              <TabsTrigger value="friends" className="gap-1.5">
                <Users className="size-4" />
                {t("friends.myFriends")}
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-1.5">
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

            <TabsContent value="friends">
              <FriendsList />
            </TabsContent>

            <TabsContent value="requests">
              <FriendRequests />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - suggestions and search */}
        <div className="space-y-6">
          <FriendSuggestions />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="size-4" />
                {t("friends.search.placeholder")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UserSearch />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
