import {
  useAddComment,
  useAddReaction,
  useDeleteComment,
  usePhotoComments,
  usePhotoReactions,
  useRemoveReaction,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { ALLOWED_EMOJIS } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { Send, Trash2, X } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
} from "react-native";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PhotoDetailModalProps {
  visible: boolean;
  photoId: string | null;
  photoUrl: string | null;
  groupId: string;
  onClose: () => void;
}

/**
 * Format a relative time string from a date
 */
function formatRelativeTime(
  dateStr: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return t("groups.gallery.photoDetail.justNow", {
      defaultValue: "Just now",
    });
  }
  if (diffMinutes < 60) {
    return t("groups.gallery.photoDetail.minutesAgo", {
      count: diffMinutes,
      defaultValue: `${diffMinutes}m ago`,
    });
  }
  if (diffHours < 24) {
    return t("groups.gallery.photoDetail.hoursAgo", {
      count: diffHours,
      defaultValue: `${diffHours}h ago`,
    });
  }
  return t("groups.gallery.photoDetail.daysAgo", {
    count: diffDays,
    defaultValue: `${diffDays}d ago`,
  });
}

export function PhotoDetailModal({
  visible,
  photoId,
  photoUrl,
  groupId,
  onClose,
}: PhotoDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [imageLoading, setImageLoading] = useState(true);
  const [commentText, setCommentText] = useState("");

  // Data hooks
  const { data: reactionsData } = usePhotoReactions(photoId || "", groupId);
  const { data: comments } = usePhotoComments(photoId || "", groupId);
  const addReaction = useAddReaction();
  const removeReaction = useRemoveReaction();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  const userReactions = reactionsData?.userReactions || [];
  const reactions = reactionsData?.reactions || [];

  const handleToggleReaction = useCallback(
    async (emoji: string) => {
      if (!photoId) return;

      try {
        const hasReacted = userReactions.includes(emoji);
        if (hasReacted) {
          await removeReaction.mutateAsync({ photoId, groupId, emoji });
        } else {
          await addReaction.mutateAsync({ photoId, groupId, emoji });
        }
      } catch {
        // Error handling is in the mutation hooks
      }
    },
    [photoId, groupId, userReactions, addReaction, removeReaction],
  );

  const handleAddComment = useCallback(async () => {
    if (!photoId || !commentText.trim()) return;

    try {
      await addComment.mutateAsync({
        photoId,
        groupId,
        content: commentText.trim(),
      });
      setCommentText("");
    } catch {
      // Error handling is in the mutation hooks
    }
  }, [photoId, groupId, commentText, addComment]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!photoId) return;

      try {
        await deleteComment.mutateAsync({ photoId, commentId, groupId });
      } catch {
        // Error handling is in the mutation hooks
      }
    },
    [photoId, groupId, deleteComment],
  );

  const getReactionCount = useCallback(
    (emoji: string): number => {
      const reaction = reactions.find(
        (r: { emoji: string; count: number }) => r.emoji === emoji,
      );
      return reaction?.count || 0;
    },
    [reactions],
  );

  const renderComment = useCallback(
    ({
      item,
    }: {
      item: {
        id: string;
        userId: string;
        username: string;
        avatarUrl: string | null;
        content: string;
        createdAt: string;
      };
    }) => {
      const isOwnComment = item.userId === user?.id;

      return (
        <HStack space="sm" className="px-4 py-2">
          <Avatar size="xs">
            {item.avatarUrl ? (
              <AvatarImage
                source={{ uri: getAvatarUrl(item.avatarUrl) }}
                alt={item.username}
              />
            ) : (
              <AvatarFallbackText>
                {getInitials({ username: item.username })}
              </AvatarFallbackText>
            )}
          </Avatar>
          <VStack className="flex-1">
            <HStack className="items-center justify-between">
              <HStack space="xs" className="items-center">
                <Text className="text-typography-900 text-sm font-semibold">
                  {item.username}
                </Text>
                <Text className="text-typography-400 text-xs">
                  {formatRelativeTime(item.createdAt, t)}
                </Text>
              </HStack>
              {isOwnComment && (
                <Pressable
                  onPress={() => handleDeleteComment(item.id)}
                  accessibilityLabel={t(
                    "groups.gallery.photoDetail.deleteComment",
                    { defaultValue: "Delete" },
                  )}
                  className="p-1"
                >
                  <Trash2 size={14} color={IconColors.error} />
                </Pressable>
              )}
            </HStack>
            <Text className="text-typography-700 text-sm">{item.content}</Text>
          </VStack>
        </HStack>
      );
    },
    [user?.id, t, handleDeleteComment],
  );

  if (!visible || !photoId || !photoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-white">
          {/* Header with close button */}
          <View className="border-outline-200 flex-row items-center justify-between border-b px-4 pt-12 pb-2">
            <Text className="text-typography-900 text-lg font-semibold">
              {t("groups.gallery.photoDetail.reactions", {
                defaultValue: "Reactions",
              })}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close"
              className="rounded-full p-2"
            >
              <X size={24} color={IconColors.default} />
            </Pressable>
          </View>

          {/* Photo */}
          <View className="items-center bg-black">
            {imageLoading && (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
            <Image
              source={{ uri: photoUrl }}
              style={{
                width: SCREEN_WIDTH,
                height: SCREEN_WIDTH * 0.75,
              }}
              resizeMode="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
            />
          </View>

          {/* Emoji Reactions Row */}
          <View className="border-outline-200 border-b px-4 py-3">
            <HStack space="sm" className="justify-center">
              {ALLOWED_EMOJIS.map((emoji) => {
                const hasReacted = userReactions.includes(emoji);
                const count = getReactionCount(emoji);

                return (
                  <Pressable
                    key={emoji}
                    onPress={() => handleToggleReaction(emoji)}
                    accessibilityLabel={`React with ${emoji}`}
                    accessibilityHint={
                      hasReacted ? "Tap to remove reaction" : "Tap to react"
                    }
                    className={`flex-row items-center rounded-full px-3 py-1.5 ${
                      hasReacted
                        ? "border-primary-500 bg-primary-50 border-2"
                        : "border-outline-200 bg-background-50 border"
                    }`}
                  >
                    <Text className="text-lg">{emoji}</Text>
                    {count > 0 && (
                      <Text
                        className={`ml-1 text-xs font-semibold ${
                          hasReacted
                            ? "text-primary-600"
                            : "text-typography-500"
                        }`}
                      >
                        {count}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </HStack>
          </View>

          {/* Comments Section */}
          <View className="flex-1">
            <View className="border-outline-200 border-b px-4 py-2">
              <Text className="text-typography-700 text-sm font-semibold">
                {t("groups.gallery.photoDetail.comments", {
                  defaultValue: "Comments",
                })}
              </Text>
            </View>

            {comments && comments.length > 0 ? (
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item.id}
                className="flex-1"
                contentContainerStyle={{ paddingVertical: 4 }}
              />
            ) : (
              <View className="flex-1 items-center justify-center p-8">
                <Text className="text-typography-400 text-center text-sm">
                  {t("groups.gallery.photoDetail.noComments", {
                    defaultValue: "No comments yet. Be the first!",
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Comment Input */}
          <View className="border-outline-200 border-t px-4 py-3 pb-8">
            <HStack space="sm" className="items-center">
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder={t("groups.gallery.photoDetail.addComment", {
                  defaultValue: "Add a comment...",
                })}
                placeholderTextColor={Colors.gray[400]}
                maxLength={500}
                multiline
                className="border-outline-300 bg-background-50 text-typography-900 flex-1 rounded-full border px-4 py-2 text-sm"
              />
              <Pressable
                onPress={handleAddComment}
                disabled={!commentText.trim() || addComment.loading}
                accessibilityLabel={t("groups.gallery.photoDetail.send", {
                  defaultValue: "Send",
                })}
                className={`rounded-full p-2 ${
                  commentText.trim() ? "bg-primary-500" : "bg-background-200"
                }`}
              >
                {addComment.loading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Send
                    size={18}
                    color={
                      commentText.trim()
                        ? IconColors.white
                        : IconColors.disabled
                    }
                  />
                )}
              </Pressable>
            </HStack>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
