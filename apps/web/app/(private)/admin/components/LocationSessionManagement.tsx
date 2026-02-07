"use client";

import { useTranslation } from "@prostcounter/shared/i18n";
import { format } from "date-fns";
import { RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";

interface LocationSessionWithDetails {
  id: string;
  userId: string;
  festivalId: string;
  isActive: boolean;
  startedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string | null;
  };
  festival: {
    id: string;
    name: string;
  };
}

const LocationSessionManagement = () => {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<LocationSessionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [stoppingSessionId, setStoppingSessionId] = useState<string | null>(
    null,
  );

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch("/api/v1/admin/location/sessions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch sessions");
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleForceStop = async (sessionId: string) => {
    setStoppingSessionId(sessionId);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `/api/v1/admin/location/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to stop session");
      }

      toast.success(t("admin.location.stopSuccess"));
      fetchSessions();
    } catch (error) {
      console.error("Error stopping session:", error);
      toast.error(t("admin.location.stopError"));
    } finally {
      setStoppingSessionId(null);
    }
  };

  const handleCleanupExpired = async () => {
    setIsCleaningUp(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch("/api/v1/admin/location/sessions/cleanup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to cleanup sessions");
      }

      const data = await response.json();
      toast.success(
        t("admin.location.cleanupSuccess", { count: data.cleanedCount }),
      );
      fetchSessions();
    } catch (error) {
      console.error("Error cleaning up sessions:", error);
      toast.error("Failed to cleanup sessions");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy HH:mm");
    } catch {
      return dateString;
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.location.title")}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanupExpired}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? "Cleaning..." : t("admin.location.cleanupExpired")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-gray-500">
          {t("admin.location.loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          {t("admin.location.noSessions")}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.location.columns.user")}</TableHead>
                <TableHead>{t("admin.location.columns.festival")}</TableHead>
                <TableHead>{t("admin.location.columns.startedAt")}</TableHead>
                <TableHead>{t("admin.location.columns.expiresAt")}</TableHead>
                <TableHead className="text-right">
                  {t("admin.location.columns.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{session.user.username}</div>
                      {session.user.fullName && (
                        <div className="text-sm text-gray-500">
                          {session.user.fullName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{session.festival.name}</TableCell>
                  <TableCell>{formatDate(session.startedAt)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        isExpired(session.expiresAt)
                          ? "text-red-500"
                          : "text-green-600"
                      }
                    >
                      {formatDate(session.expiresAt)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleForceStop(session.id)}
                      disabled={stoppingSessionId === session.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {stoppingSessionId === session.id
                        ? "Stopping..."
                        : t("admin.location.forceStop")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default LocationSessionManagement;
