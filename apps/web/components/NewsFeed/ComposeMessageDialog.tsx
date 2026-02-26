"use client";

import { usePostMessage } from "@prostcounter/shared/hooks";
import type { GroupMessageType } from "@prostcounter/shared/schemas";
import { AlertTriangle, Loader2, MessageSquare, Send } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const MAX_CHARS = 1000;

interface ComposeMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  festivalId: string;
  onSuccess?: () => void;
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
  festivalId,
  onSuccess,
}: ComposeMessageDialogProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<GroupMessageType>("message");

  const postMessage = usePostMessage();

  const handleSend = useCallback(async () => {
    if (!content.trim() || !festivalId) return;

    try {
      await postMessage.mutateAsync({
        content: content.trim(),
        messageType,
        festivalId,
      });
      setContent("");
      setMessageType("message");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  }, [content, messageType, festivalId, postMessage, onOpenChange, onSuccess]);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setContent("");
        setMessageType("message");
      }
      onOpenChange(isOpen);
    },
    [onOpenChange],
  );

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = content.trim().length > 0 && !isOverLimit;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("groups.messages.compose.title")}</DialogTitle>
          <DialogDescription>
            {messageType === "alert"
              ? t("groups.messages.compose.subtitleAlert")
              : t("groups.messages.compose.subtitleMessage")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Message type toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMessageType("message")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                messageType === "message"
                  ? "border-yellow-500 bg-yellow-50 text-yellow-600"
                  : "border-border text-muted-foreground hover:bg-muted/50 bg-white",
              )}
            >
              <MessageSquare className="size-4" />
              {t("groups.messages.compose.typeMessage")}
            </button>

            <button
              type="button"
              onClick={() => setMessageType("alert")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors",
                messageType === "alert"
                  ? "border-yellow-500 bg-amber-50 text-yellow-600"
                  : "border-border text-muted-foreground hover:bg-muted/50 bg-white",
              )}
            >
              <AlertTriangle className="size-4" />
              {t("groups.messages.compose.typeAlert")}
            </button>
          </div>

          {/* Text input */}
          <div className="flex flex-col gap-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("groups.messages.compose.placeholder")}
              maxLength={MAX_CHARS + 50}
              rows={4}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground min-h-[100px] resize-none rounded-lg border p-3 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 focus:outline-none"
              autoFocus
            />
            <span
              className={cn(
                "text-xs",
                isOverLimit ? "text-red-500" : "text-muted-foreground",
              )}
            >
              {t("groups.messages.compose.charCount", {
                count: charCount,
                max: MAX_CHARS,
              })}
            </span>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!canSend || postMessage.loading}
            className="w-full bg-yellow-500 text-white hover:bg-yellow-600"
          >
            {postMessage.loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            {postMessage.loading
              ? t("groups.messages.compose.sending")
              : t("groups.messages.compose.send")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
