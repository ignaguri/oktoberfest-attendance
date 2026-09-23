"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n/client";

import AnalyticsDashboard from "./components/analytics/AnalyticsDashboard";
import CacheManagement from "./components/CacheManagement";
import FestivalManagement from "./components/FestivalManagement";
import GroupList from "./components/GroupList";
import ImageConversion from "./components/ImageConversion";
import LocationSessionManagement from "./components/LocationSessionManagement";
import TentManagement from "./components/TentManagement";
import UserList from "./components/UserList";

const tabValues = [
  "users",
  "groups",
  "festivals",
  "tents",
  "cache",
  "images",
  "location",
  "analytics",
];

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");
  const searchParams = useSearchParams();

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
        // Swap ?tab= for the hash without navigating. A router.push to the
        // same URL yields new searchParams, re-running this effect forever.
        window.history.replaceState(null, "", `${window.location.pathname}#${tab}`);
      }
    }
  }, [searchParams]);

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
          <TabsTrigger value="festivals">{t("admin.tabs.festivals")}</TabsTrigger>
          <TabsTrigger value="tents">{t("admin.tabs.tents")}</TabsTrigger>
          <TabsTrigger value="cache">{t("admin.tabs.cache")}</TabsTrigger>
          <TabsTrigger value="images">{t("admin.tabs.imageConversion")}</TabsTrigger>
          <TabsTrigger value="location">{t("admin.tabs.location")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("admin.tabs.analytics")}</TabsTrigger>
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

        <TabsContent value="location">
          <LocationSessionManagement />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
