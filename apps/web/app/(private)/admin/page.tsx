"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useState, startTransition } from "react";

import CacheManagement from "./components/CacheManagement";
import FestivalManagement from "./components/FestivalManagement";
import GroupList from "./components/GroupList";
import ImageConversion from "./components/ImageConversion";
import TentManagement from "./components/TentManagement";
import UserList from "./components/UserList";

const tabValues = ["users", "groups", "festivals", "tents", "cache", "images"];

export default function AdminPage() {
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
      <h1 className="mb-4 text-2xl font-bold">Admin Dashboard</h1>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="festivals">Festivals</TabsTrigger>
          <TabsTrigger value="tents">Tents</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
          <TabsTrigger value="images">Image Conversion</TabsTrigger>
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
