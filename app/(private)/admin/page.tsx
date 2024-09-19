"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import UserList from "./components/UserList";
import CacheManagement from "./components/CacheManagement";
import GroupList from "./components/GroupList";

export default function AdminPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <Tabs defaultValue="users" className="mb-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserList />
        </TabsContent>

        <TabsContent value="groups">
          <GroupList />
        </TabsContent>

        <TabsContent value="cache">
          <CacheManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
