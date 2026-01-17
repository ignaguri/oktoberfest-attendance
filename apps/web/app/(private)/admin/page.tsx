"use client";

import { useSearchParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { startTransition, useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/client";

import CacheManagement from "./components/CacheManagement";
import FestivalManagement from "./components/FestivalManagement";
import GroupList from "./components/GroupList";
import ImageConversion from "./components/ImageConversion";
import TentManagement from "./components/TentManagement";
import UserList from "./components/UserList";

const tabValues = ["users", "groups", "festivals", "tents", "cache", "images"];

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");
  const searchParams = useSearchParams();
  const router = useTransitionRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (tabValues.includes(hash)) {
      startTransition(() => {
        setActiveTab(hash);
      });
    } else {
      const tab = searchParams.get("tab");
      if (tab && tabValues.includes(tab)) {
        startTransition(() => {
          setActiveTab(tab);
        });
        // Update URL hash if tab is set via query parameter
        router.push(`/admin?tab=${tab}`);
      }
    }
  }, [searchParams, router]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL hash when changing tabs
    window.location.hash = value;
  };

  return (
    <div className="container mx-auto flex flex-col items-center p-4">
      <h1 className="mb-4 text-2xl font-bold">{t("admin.dashboard")}</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="users">{t("admin.tabs.users")}</TabsTrigger>
          <TabsTrigger value="groups">{t("admin.tabs.groups")}</TabsTrigger>
          <TabsTrigger value="festivals">
            {t("admin.tabs.festivals")}
          </TabsTrigger>
          <TabsTrigger value="tents">{t("admin.tabs.tents")}</TabsTrigger>
          <TabsTrigger value="cache">{t("admin.tabs.cache")}</TabsTrigger>
          <TabsTrigger value="images">
            {t("admin.tabs.imageConversion")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserList />
        </TabsContent>

        <TabsContent value="groups">
          <GroupList />
        </TabsContent>

        <TabsContent value="festivals">
          <FestivalManagement />
        </TabsContent>

        <TabsContent value="tents">
          <TentManagement />
        </TabsContent>

        <TabsContent value="cache">
          <CacheManagement />
        </TabsContent>

        <TabsContent value="images">
          <ImageConversion />
        </TabsContent>
      </Tabs>
    </div>
  );
}
