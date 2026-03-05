"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useDeleteMessage, useGroupMessages } from "@prostcounter/shared/hooks";
import type { GroupMessageItem } from "@prostcounter/shared/schemas";
import { MessageSquare, Plus } from "lucide-react";
import { use, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import LoadingSpinner from "@/components/LoadingSpinner";
import { MessageItem } from "@/components/messages/MessageItem";
import { ComposeMessageDialog } from "@/components/NewsFeed/ComposeMessageDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "@/lib/i18n/client";

interface MessagesPageProps {
  params: Promise<{ id: string }>;
}

export default function MessagesPage({ params }: MessagesPageProps) {
  const { t } = useTranslation();
  const { id: groupId } = use(params);
  const { currentFestival } = useFestival();

  const { messages, loading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGroupMessages(groupId);
  const { mutateAsync: deleteMessage } = useDeleteMessage();

  const [composeOpen, setComposeOpen] = useState(false);

  const pinnedMessages = useMemo(
    () =>
      (messages as GroupMessageItem[]).filter(
        (m: GroupMessageItem) => m.pinned,
      ),
    [messages],
  );

  const regularMessages = useMemo(
    () =>
      (messages as GroupMessageItem[]).filter(
        (m: GroupMessageItem) => !m.pinned,
      ),
    [messages],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!confirm(t("groups.messages.item.deleteConfirmMessage"))) return;
      try {
        await deleteMessage({ messageId });
        toast.success(t("groups.messages.item.deleteSuccess"));
      } catch {
        toast.error(t("groups.messages.item.deleteError"));
      }
    },
    [deleteMessage, t],
  );

  if (loading && messages.length === 0) {
    return (
      <div className="container mx-auto flex max-w-xl items-center justify-center p-4 py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("groups.messages.title")}</h1>
        <Button size="sm" onClick={() => setComposeOpen(true)}>
          <Plus className="mr-1 size-4" />
          {t("groups.messages.compose.title")}
        </Button>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("groups.messages.empty.title")}
          description={t("groups.messages.empty.description")}
          actionLabel={t("groups.messages.compose.title")}
          onAction={() => setComposeOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pinned messages */}
          {pinnedMessages.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-yellow-700">
                  {t("groups.messages.item.pinned")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 p-2">
                {pinnedMessages.map((msg: GroupMessageItem) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onDelete={handleDelete}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Regular messages */}
          {regularMessages.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-1 p-2">
                {regularMessages.map((msg: GroupMessageItem) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onDelete={handleDelete}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Load more */}
          {hasNextPage && (
            <Button
              variant="outline"
              onClick={fetchNextPage}
              disabled={isFetchingNextPage}
              className="w-full"
            >
              {isFetchingNextPage
                ? t("common.buttons.loading")
                : t("common.buttons.loadMore")}
            </Button>
          )}
        </div>
      )}

      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        festivalId={currentFestival?.id ?? ""}
      />
    </div>
  );
}
