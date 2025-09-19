"use client";

import { logout } from "@/components/Auth/actions";
import Avatar from "@/components/Avatar/Avatar";
import { ShareDialog } from "@/components/ShareDialog/ShareDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  menuItems,
  menuSections,
  getMenuItemsBySection,
} from "@/components/UserMenu/menuConfig";
import { WhatsNew } from "@/components/WhatsNew";
import { useFestival } from "@/contexts/FestivalContext";
import { useInstallPWA } from "@/hooks/use-install-pwa";
import { getFestivalStatus } from "@/lib/festivalConstants";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ChevronDown, CalendarDays } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import type { BadgeVariants } from "@/components/ui/badge";
import type { FestivalStatus, Festival as FestivalType } from "@/lib/types";

interface UserMenuProps {
  profileData: {
    username: string | null;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  className?: string;
}

const getFestivalDisplayInfo = (festival: FestivalType) => {
  const firstLetter = festival.name.charAt(0).toUpperCase();
  const yearMatch = festival.name.match(/(\d{4})/);
  const lastTwoDigits = yearMatch ? yearMatch[1].slice(-2) : "??";
  return { firstLetter, lastTwoDigits };
};

const getFestivalStatusBadgeProps = (
  festival: FestivalType,
): { status: FestivalStatus; variant: BadgeVariants } => {
  const status = getFestivalStatus(festival);

  if (status === "upcoming") {
    return { status, variant: "default" };
  } else if (status === "active") {
    return { status, variant: "success" };
  } else {
    return { status, variant: "secondary" };
  }
};

export function UserMenu({ profileData, className }: UserMenuProps) {
  const { currentFestival, festivals, setCurrentFestival, isLoading } =
    useFestival();
  const { canInstall, installPWA } = useInstallPWA();
  const [isOpen, setIsOpen] = useState(false);
  const [isFestivalModalOpen, setIsFestivalModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
  };

  const getMenuItemsWithHandlers = () => {
    return menuItems.map((item) => {
      if (item.id === "signout") {
        return { ...item, onClick: handleSignOut };
      }
      if (item.id === "share") {
        return {
          ...item,
          onClick: () => setIsShareDialogOpen(true),
        };
      }
      if (item.id === "changeFestival") {
        return {
          ...item,
          onClick: () => setIsFestivalModalOpen(true),
        };
      }
      if (item.id === "whatsNew") {
        return {
          ...item,
          onClick: () => setIsWhatsNewOpen(true),
        };
      }
      if (item.id === "installApp") {
        return {
          ...item,
          onClick: installPWA,
          disabled: !canInstall,
        };
      }
      return item;
    });
  };

  const renderMenuItem = (
    item: ReturnType<typeof getMenuItemsWithHandlers>[0],
  ) => {
    if (item.href) {
      return (
        <DropdownMenuItem key={item.id} asChild>
          <Link href={item.href} className="flex items-center gap-2">
            {item.icon}
            {item.label}
          </Link>
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuItem
        key={item.id}
        onClick={item.onClick}
        disabled={item.disabled}
        className={cn(
          "flex items-center gap-2",
          item.variant === "destructive" &&
            "text-destructive focus:text-destructive",
        )}
      >
        {item.icon}
        {item.label}
      </DropdownMenuItem>
    );
  };

  const renderFestivalSection = () => {
    if (isLoading || !currentFestival) return null;

    const { firstLetter, lastTwoDigits } =
      getFestivalDisplayInfo(currentFestival);
    const { status, variant } = getFestivalStatusBadgeProps(currentFestival);

    return (
      <>
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          Current Festival
        </DropdownMenuLabel>
        <div className="px-2 py-1.5">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <div className="h-8 w-8 rounded-md bg-yellow-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {firstLetter}
              <sub className="text-xs">{lastTwoDigits}</sub>
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">
                {currentFestival.name}
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={variant as BadgeVariants}
                  className="text-xs capitalize w-fit"
                >
                  {status}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {format(parseISO(currentFestival.start_date), "MMM d")} -{" "}
                  {format(parseISO(currentFestival.end_date), "MMM d")}
                </div>
              </div>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
      </>
    );
  };

  const renderFestivalSelectionModal = () => {
    if (festivals.length <= 1) return null;

    return (
      <Dialog open={isFestivalModalOpen} onOpenChange={setIsFestivalModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Festival</DialogTitle>
            <DialogDescription>
              Choose which festival you want to view and participate in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-96 overflow-y-auto">
            {festivals.map((festival) => {
              const { firstLetter, lastTwoDigits } =
                getFestivalDisplayInfo(festival);
              const { status, variant } = getFestivalStatusBadgeProps(festival);
              const isSelected = festival.id === currentFestival?.id;

              return (
                <Button
                  key={festival.id}
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "justify-start h-auto p-4 w-full",
                    isSelected &&
                      "bg-yellow-500 hover:bg-yellow-600 border-yellow-500",
                  )}
                  onClick={() => {
                    setCurrentFestival(festival);
                    setIsFestivalModalOpen(false);
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-md flex items-center justify-center font-semibold flex-shrink-0",
                        isSelected
                          ? "bg-white text-yellow-500"
                          : "bg-yellow-500 text-white",
                      )}
                    >
                      <span className="text-base">
                        {firstLetter}
                        <sub className="text-sm">{lastTwoDigits}</sub>
                      </span>
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{festival.name}</span>
                        <Badge className="capitalize" variant={variant}>
                          {status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {format(parseISO(festival.start_date), "MMM d")} -{" "}
                        {format(parseISO(festival.end_date), "MMM d, yyyy")}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {festival.location}
                      </span>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderShareDialog = () => {
    return (
      <ShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
      />
    );
  };

  const renderWhatsNewDialog = () => {
    return (
      <WhatsNew
        open={isWhatsNewOpen}
        onOpenChange={setIsWhatsNewOpen}
        isManualTrigger={true}
      />
    );
  };

  const menuItemsWithHandlers = getMenuItemsWithHandlers();

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "flex items-center gap-2 p-2 h-auto hover:bg-gray-700",
              className,
            )}
          >
            <Avatar
              url={profileData.avatar_url}
              fallback={{
                username: profileData.username,
                full_name: profileData.full_name,
                email: profileData.email || "no.name@user.com",
              }}
            />
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-sm font-medium text-white">
                {profileData.full_name || profileData.username || "User"}
              </span>
              <span className="text-xs text-gray-300">
                {currentFestival?.name || "No festival selected"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-300" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 max-h-[80vh] overflow-y-auto"
          sideOffset={8}
        >
          {/* Festival Section - Always read-only */}
          {renderFestivalSection()}

          {/* Render each section */}
          {menuSections.map((section) => {
            const sectionItems = getMenuItemsBySection(section.id);
            const itemsWithHandlers = sectionItems.map(
              (item) =>
                menuItemsWithHandlers.find(
                  (handlerItem) => handlerItem.id === item.id,
                )!,
            );

            return (
              <div key={section.id}>
                {/* <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  {section.label}
                </DropdownMenuLabel> */}
                {itemsWithHandlers.map(renderMenuItem)}
                {section.id !== menuSections[menuSections.length - 1].id && (
                  <DropdownMenuSeparator />
                )}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Festival Selection Modal */}
      {renderFestivalSelectionModal()}

      {/* Share Dialog */}
      {renderShareDialog()}

      {/* What's New Dialog */}
      {renderWhatsNewDialog()}
    </>
  );
}
