"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { usePostMessage } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupMessageType } from "@prostcounter/shared/schemas";
import { Send } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_CHARS = 1000;

interface ComposeMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeMessageDialog({
  open,
  onOpenChange,
}: ComposeMessageDialogProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const festivalId = currentFestival?.id;
  const { mutateAsync: postMessage, loading: isPosting } = usePostMessage();

  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<GroupMessageType>("message");

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || !festivalId) return;
    try {
      await postMessage({
        content: content.trim(),
        messageType,
        festivalId,
      });
      toast.success(t("groups.messages.compose.success"));
      setContent("");
      setMessageType("message");
      onOpenChange(false);
    } catch {
      toast.error(t("groups.messages.compose.error"));
    }
  }, [content, messageType, festivalId, postMessage, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                messageType === "message"
                  ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              {t("groups.messages.compose.typeMessage")}
            </button>
            <button
              type="button"
              onClick={() => setMessageType("alert")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                messageType === "alert"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              )}
            >
              {t("groups.messages.compose.typeAlert")}
            </button>
          </div>

          {/* Text input */}
          <div className="flex flex-col gap-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder={t("groups.messages.compose.placeholder")}
              rows={4}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 focus:outline-none"
            />
            <span className="text-right text-xs text-gray-400">
              {t("groups.messages.compose.charCount", {
                count: content.length,
                max: MAX_CHARS,
              })}
            </span>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || isPosting}
            className="w-full"
          >
            {isPosting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t("groups.messages.compose.sending")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="size-4" />
                {t("groups.messages.compose.send")}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
