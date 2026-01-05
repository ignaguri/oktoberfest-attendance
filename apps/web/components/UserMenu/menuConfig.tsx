import {
  Calendar,
  CalendarSync,
  Download,
  LogOut,
  MapPin,
  Medal,
  Share2,
  Trophy,
  User,
  Users,
  Sparkles,
} from "lucide-react";

import type { TFunction } from "i18next";

export interface MenuItem {
  id: string;
  labelKey: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  section: "navigation" | "settings" | "actions";
}

export interface MenuItemWithLabel extends Omit<MenuItem, "labelKey"> {
  label: string;
}

export interface MenuSection {
  id: string;
  labelKey: string;
  icon?: React.ReactNode;
  items: string[];
}

export interface MenuSectionWithLabel extends Omit<MenuSection, "labelKey"> {
  label: string;
}

const menuItemsConfig: MenuItem[] = [
  // Navigation Section
  {
    id: "attendance",
    labelKey: "common.menu.attendance",
    href: "/attendance",
    icon: <Calendar className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "groups",
    labelKey: "common.menu.groups",
    href: "/groups",
    icon: <Users className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "leaderboard",
    labelKey: "common.menu.leaderboard",
    href: "/leaderboard",
    icon: <Trophy className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "achievements",
    labelKey: "common.menu.achievements",
    href: "/achievements",
    icon: <Medal className="h-4 w-4" />,
    section: "navigation",
  },

  // Settings Section
  {
    id: "profile",
    labelKey: "common.menu.profile",
    href: "/profile",
    icon: <User className="h-4 w-4" />,
    section: "settings",
  },
  {
    id: "map",
    labelKey: "common.menu.map",
    href: "https://wiesnmap.muenchen.de",
    icon: <MapPin className="h-4 w-4" />,
    section: "settings",
  },
  {
    id: "whatsNew",
    labelKey: "common.menu.whatsNew",
    icon: <Sparkles className="h-4 w-4" />,
    section: "settings",
  },

  // Actions Section
  {
    id: "installApp",
    labelKey: "common.menu.installApp",
    icon: <Download className="h-4 w-4" />,
    section: "settings",
  },
  {
    id: "changeFestival",
    labelKey: "common.menu.changeFestival",
    icon: <CalendarSync className="h-4 w-4" />,
    section: "actions",
  },
  {
    id: "share",
    labelKey: "common.menu.share",
    icon: <Share2 className="h-4 w-4" />,
    section: "actions",
  },
  {
    id: "signout",
    labelKey: "common.menu.signOut",
    icon: <LogOut className="h-4 w-4" />,
    section: "actions",
  },
];

const menuSectionsConfig: MenuSection[] = [
  {
    id: "navigation",
    labelKey: "common.menu.navigation",
    items: ["attendance", "groups", "leaderboard", "achievements"],
  },
  {
    id: "settings",
    labelKey: "common.menu.settingsTools",
    items: ["profile", "map", "whatsNew"],
  },
  {
    id: "actions",
    labelKey: "common.menu.actions",
    items: ["installApp", "changeFestival", "share", "signout"],
  },
];

/**
 * Get menu items with translated labels
 */
export const getMenuItems = (t: TFunction): MenuItemWithLabel[] => {
  return menuItemsConfig.map((item) => ({
    ...item,
    label: t(item.labelKey),
  }));
};

/**
 * Get menu sections with translated labels
 */
export const getMenuSections = (t: TFunction): MenuSectionWithLabel[] => {
  return menuSectionsConfig.map((section) => ({
    ...section,
    label: t(section.labelKey),
  }));
};

/**
 * Get menu items by section with translated labels
 */
export const getMenuItemsBySection = (
  t: TFunction,
  sectionId: string,
): MenuItemWithLabel[] => {
  return getMenuItems(t).filter((item) => item.section === sectionId);
};

/**
 * Get a single menu item by ID with translated label
 */
export const getMenuItemById = (
  t: TFunction,
  id: string,
): MenuItemWithLabel | undefined => {
  return getMenuItems(t).find((item) => item.id === id);
};
