"use client";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { renewGroupToken } from "@/lib/actions";
import { Share2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface ShareButtonProps {
  groupName: string;
  groupId: string;
  groupPassword: string;
  withText?: boolean;
}

const ICON_SIZE = 20;

export default function ShareButton({
  groupName,
  groupId,
  groupPassword,
  withText = false,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy Invite Text");
  const [groupLink, setGroupLink] = useState("");
  const [tokenGenerated, setTokenGenerated] = useState(false);
  const { toast } = useToast();

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";

  const generateShareLink = useCallback(async () => {
    try {
      const token = await renewGroupToken(groupId);
      const newGroupLink = `${APP_URL}/api/join-group?token=${token}`;
      setGroupLink(newGroupLink);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate share link. Please try again.",
      });
    }
  }, [groupId, APP_URL, toast]);

  const shareText = `Join my group "${groupName}" on the ProstCounter app!\nGroup password: ${groupPassword}.\nClick here to join: ${groupLink}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyButtonText("Copied!");
      setTimeout(() => {
        setCopyButtonText("Copy Invite Text");
      }, 3000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy text to clipboard.",
      });
    }
  };

  useEffect(() => {
    if (open && !tokenGenerated) {
      generateShareLink();
      setTokenGenerated(true); // Set to true after generating the token
    }
  }, [generateShareLink, open, tokenGenerated]);

  const title = "Invite to join";
  const description = "Choose how you’d like to share the group information:";

  const ButtonsGroup = () => (
    <div className="flex flex-col gap-2 items-center p-8">
      <Button variant="yellowOutline" onClick={copyToClipboard}>
        {copyButtonText}
      </Button>
      <Button
        variant="yellow"
        onClick={() =>
          window.open(
            `https://wa.me/?text=${encodeURIComponent(shareText)}`,
            "_blank",
          )
        }
      >
        Share via WhatsApp
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      trigger={
        <Button variant="yellow" className="flex items-center">
          <Share2 size={ICON_SIZE} />
          {withText && <span className="ml-2">{title}</span>}
        </Button>
      }
      className="sm:max-w-[425px]" // Pass className here
    >
      <ButtonsGroup />
    </ResponsiveDialog>
  );
}
