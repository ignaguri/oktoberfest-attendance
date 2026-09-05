"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { formatLocalized } from "@prostcounter/shared/utils";
import { parseISO } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Link } from "next-view-transitions";
import { useMemo, useState } from "react";

import { logout } from "@/components/Auth/actions";
import Avatar from "@/components/Avatar/Avatar";
import { FestivalSelectorDialog } from "@/components/FestivalSelectorDialog";
import { ShareDialog } from "@/components/ShareDialog/ShareDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getMenuItems,
  getMenuItemsBySection,
  getMenuSections,
} from "@/components/UserMenu/menuConfig";
import { WhatsNew } from "@/components/WhatsNew";
import { useInstallBanner } from "@/hooks/use-install-banner";
import { getFestivalDisplayInfo, getFestivalStatusBadgeProps } from "@/lib/festivalConstants";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  profileData: {
    username: string | null;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  className?: string;
}

export function UserMenu({ profileData, className }: UserMenuProps) {
  const { t } = useTranslation();
  const { currentFestival, festivals, isLoading } = useFestival();
  const { canInstall, triggerInstall } = useInstallBanner({ enabled: false });
  const [isOpen, setIsOpen] = useState(false);
  const [isFestivalModalOpen, setIsFestivalModalOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);

  const handleSignOut = async () => {
    await logout();
  };

  // Memoize menu items and sections to avoid recalculating on every render
  const menuItems = useMemo(() => getMenuItems(t), [t]);
  const menuSections = useMemo(() => getMenuSections(t), [t]);

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
          onClick: triggerInstall,
          disabled: !canInstall,
        };
      }
      return item;
    });
  };

  const renderMenuItem = (item: ReturnType<typeof getMenuItemsWithHandlers>[0]) => {
    if (item.href) {
      return (
        <DropdownMenuItem key={item.id} asChild className="cursor-pointer py-2">
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
          "flex cursor-pointer items-center gap-2 py-2",
          item.variant === "destructive" && "text-destructive focus:text-destructive",
        )}
      >
        {item.icon}
        {item.label}
      </DropdownMenuItem>
    );
  };

  const renderFestivalSection = () => {
    if (isLoading || !currentFestival) return null;

    const { firstLetter, lastTwoDigits } = getFestivalDisplayInfo(currentFestival);
    const { status, variant } = getFestivalStatusBadgeProps(currentFestival);

    return (
      <>
        <DropdownMenuLabel className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <CalendarDays className="size-3" />
          {t("festival.selector.currentFestival")}
        </DropdownMenuLabel>
        <div className="px-2">
          <div
            className="bg-muted/50 hover:bg-muted/70 flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors"
            onClick={() => setIsFestivalModalOpen(true)}
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-yellow-600 text-sm font-semibold text-white">
              {firstLetter}
              <sub className="text-xs">{lastTwoDigits}</sub>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{currentFestival.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant={variant} className="w-fit text-xs capitalize">
                  {t(`festival.status.${status}`)}
                </Badge>
                <div className="text-muted-foreground text-xs">
                  {formatLocalized(parseISO(currentFestival.startDate), "MMM d")} -{" "}
                  {formatLocalized(parseISO(currentFestival.endDate), "MMM d")}
                </div>
              </div>
            </div>
            <ChevronDown className="text-muted-foreground size-4" />
          </div>
        </div>
        <DropdownMenuSeparator />
      </>
    );
  };

  const renderFestivalSelectionModal = () => {
    if (festivals.length <= 1) return null;

    return (
      <FestivalSelectorDialog
        isOpen={isFestivalModalOpen}
        onOpenChange={setIsFestivalModalOpen}
      />
    );
  };

  const renderShareDialog = () => {
    return <ShareDialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />;
  };

  const renderWhatsNewDialog = () => {
    return (
      <WhatsNew open={isWhatsNewOpen} onOpenChange={setIsWhatsNewOpen} isManualTrigger={true} />
    );
  };

  const menuItemsWithHandlers = getMenuItemsWithHandlers();

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn("flex h-auto items-center gap-2 p-2 hover:bg-gray-700", className)}
          >
            <Avatar
              url={profileData.avatar_url}
              fallback={{
                username: profileData.username,
                full_name: profileData.full_name,
                email: profileData.email || "no.name@user.com",
              }}
            />
            <div className="hidden flex-col items-start text-left sm:flex">
              <span className="text-sm font-medium text-white">
                {profileData.full_name || profileData.username || "User"}
              </span>
              <span className="text-xs text-gray-300">
                {currentFestival?.name || t("festival.selector.noFestival")}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-300" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="max-h-[80vh] w-80 overflow-y-auto"
          sideOffset={8}
        >
          {/* Festival Section - Always read-only */}
          {renderFestivalSection()}

          {/* Render each section */}
          {menuSections.map((section) => {
            const sectionItems = getMenuItemsBySection(t, section.id);
            const itemsWithHandlers = sectionItems.map((item) =>
              menuItemsWithHandlers.find((handlerItem) => handlerItem.id === item.id)!,
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
