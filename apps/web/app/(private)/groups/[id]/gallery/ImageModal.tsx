"use client";

import {
  useAddComment,
  useAddReaction,
  useCurrentProfile,
  useDeleteComment,
  usePhotoComments,
  usePhotoReactions,
  useRemoveReaction,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  type AggregatedReaction,
  ALLOWED_EMOJIS,
  type PhotoComment,
} from "@prostcounter/shared/schemas";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Send, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, getAvatarUrl } from "@/lib/utils";

interface ImageModalProps {
  imageUrl: string | null;
  photoId?: string | null;
  groupId?: string;
  onClose: () => void;
}

export function ImageModal({
  imageUrl,
  photoId,
  groupId,
  onClose,
}: ImageModalProps) {
  const { t } = useTranslation();
  const hasSocial = !!photoId && !!groupId;

  const { data: profile } = useCurrentProfile();
  const currentUserId = profile?.id;

  const { data: reactionsData } = usePhotoReactions(
    photoId ?? "",
    groupId ?? "",
  );
  const { data: comments } = usePhotoComments(photoId ?? "", groupId ?? "");

  const { mutateAsync: addReaction } = useAddReaction();
  const { mutateAsync: removeReaction } = useRemoveReaction();
  const { mutateAsync: addComment, loading: isAddingComment } = useAddComment();
  const { mutateAsync: deleteComment } = useDeleteComment();

  const [commentText, setCommentText] = useState("");

  const userReactions = useMemo(
    () => (reactionsData?.userReactions as string[]) ?? [],
    [reactionsData?.userReactions],
  );

  const getReactionCount = useCallback(
    (emoji: string) => {
      const reaction = (
        reactionsData?.reactions as AggregatedReaction[] | undefined
      )?.find((r: AggregatedReaction) => r.emoji === emoji);
      return reaction?.count ?? 0;
    },
    [reactionsData],
  );

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!photoId || !groupId) return;
      try {
        if (userReactions.includes(emoji)) {
          await removeReaction({ photoId, groupId, emoji });
        } else {
          await addReaction({ photoId, groupId, emoji });
        }
      } catch {
        toast.error(t("groups.gallery.photoDetail.reactionError"));
      }
    },
    [photoId, groupId, userReactions, addReaction, removeReaction, t],
  );

  const handleAddComment = useCallback(async () => {
    if (!photoId || !groupId || !commentText.trim()) return;
    try {
      await addComment({ photoId, groupId, content: commentText.trim() });
      setCommentText("");
      toast.success(t("groups.gallery.photoDetail.commentAdded"));
    } catch {
      toast.error(t("groups.gallery.photoDetail.commentError"));
    }
  }, [photoId, groupId, commentText, addComment, t]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!photoId || !groupId) return;
      try {
        await deleteComment({ photoId, commentId, groupId });
        toast.success(t("groups.gallery.photoDetail.commentDeleted"));
      } catch {
        toast.error(t("groups.gallery.photoDetail.deleteError"));
      }
    },
    [photoId, groupId, deleteComment, t],
  );

  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] flex-col overflow-hidden border-none bg-black/95 p-0",
          "sm:max-w-[90vw]",
        )}
        showCloseButton={false}
      >
        <VisuallyHidden asChild>
          <DialogTitle>Full size image</DialogTitle>
        </VisuallyHidden>

        <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-white/90 p-2 transition-colors hover:bg-white">
          <X className="size-5 text-black" />
          <span className="sr-only">
            {t("groups.gallery.photoDetail.close")}
          </span>
        </DialogClose>

        <div className={cn("flex", hasSocial ? "flex-col sm:flex-row" : "")}>
          {/* Photo */}
          <div
            className={cn(
              "relative",
              hasSocial
                ? "min-h-[40vh] flex-1 sm:min-h-[70vh]"
                : "h-[80vh] w-full",
            )}
          >
            <Image
              src={imageUrl}
              alt="Full size image"
              fill
              className="object-contain"
              priority
              sizes={hasSocial ? "(max-width: 640px) 100vw, 60vw" : "90vw"}
              unoptimized
            />
          </div>

          {/* Social panel — only shown when photoId + groupId are available */}
          {hasSocial && (
            <div className="flex w-full flex-col bg-white sm:w-80">
              {/* Reactions */}
              <div className="border-b px-4 py-3">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  {t("groups.gallery.photoDetail.reactions")}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {ALLOWED_EMOJIS.map((emoji) => {
                    const count = getReactionCount(emoji);
                    const isReacted = userReactions.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleReaction(emoji)}
                        aria-label={t("groups.gallery.photoDetail.reactWith", {
                          emoji,
                        })}
                        aria-pressed={isReacted}
                        className={cn(
                          "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
                          isReacted
                            ? "border-yellow-400 bg-yellow-50"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        )}
                      >
                        <span>{emoji}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "text-xs",
                              isReacted
                                ? "font-medium text-yellow-700"
                                : "text-gray-500",
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comments */}
              <div className="flex min-h-0 flex-1 flex-col">
                <h3 className="px-4 pt-3 pb-2 text-sm font-semibold text-gray-900">
                  {t("groups.gallery.photoDetail.comments")}
                </h3>

                <ScrollArea className="flex-1 px-4">
                  <div className="flex flex-col gap-3 pb-2">
                    {(!comments ||
                      (comments as PhotoComment[]).length === 0) && (
                      <p className="py-4 text-center text-sm text-gray-400">
                        {t("groups.gallery.photoDetail.noComments")}
                      </p>
                    )}
                    {(comments as PhotoComment[] | undefined)?.map(
                      (comment: PhotoComment) => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="size-7 flex-shrink-0">
                            <AvatarImage
                              src={getAvatarUrl(comment.avatarUrl)}
                              alt={
                                comment.username
                                  ? `${comment.username}'s avatar`
                                  : ""
                              }
                            />
                            <AvatarFallback className="text-xs">
                              {comment.username?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-900">
                                {comment.username}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatRelativeTime(
                                  new Date(comment.createdAt),
                                )}
                              </span>
                              {currentUserId === comment.userId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteComment(comment.id)
                                  }
                                  className="ml-auto text-gray-400 hover:text-red-500"
                                  aria-label={t(
                                    "groups.gallery.photoDetail.deleteComment",
                                  )}
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-700">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </ScrollArea>

                {/* Comment input */}
                <div className="flex items-center gap-2 border-t px-4 py-3">
                  <Input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t("groups.gallery.photoDetail.addComment")}
                    className="flex-1 text-sm"
                    maxLength={500}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !isAddingComment
                      ) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddComment}
                    disabled={!commentText.trim() || isAddingComment}
                    aria-label={t("groups.gallery.photoDetail.send")}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
