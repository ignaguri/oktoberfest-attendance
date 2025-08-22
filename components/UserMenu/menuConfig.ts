import {
  Calendar,
  CalendarSync,
  LogOut,
  MapPin,
  Medal,
  Share2,
  Trophy,
  User,
  Users,
} from "lucide-react";

export interface MenuItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
  section: "navigation" | "settings" | "actions";
}

export interface MenuSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
  items: string[];
}

// Icon components to be used in the menu
export const menuIcons = {
  calendar: Calendar,
  calendarSync: CalendarSync,
  logOut: LogOut,
  mapPin: MapPin,
  medal: Medal,
  share: Share2,
  trophy: Trophy,
  user: User,
  users: Users,
};

export const menuItems: MenuItem[] = [
  // Navigation Section
  {
    id: "attendance",
    label: "My Attendances",
    href: "/attendance",
    icon: "calendar",
    section: "navigation",
  },
  {
    id: "groups",
    label: "Groups",
    href: "/groups",
    icon: "users",
    section: "navigation",
  },
  {
    id: "leaderboard",
    label: "Global Leaderboard",
    href: "/leaderboard",
    icon: "trophy",
    section: "navigation",
  },
  {
    id: "achievements",
    label: "Achievements",
    href: "/achievements",
    icon: "medal",
    section: "navigation",
  },

  // Settings Section
  {
    id: "profile",
    label: "Profile Settings",
    href: "/profile",
    icon: "user",
    section: "settings",
  },
  {
    id: "changeFestival",
    label: "Change Festival",
    icon: "calendarSync",
    section: "settings",
  },
  {
    id: "map",
    label: "Festival Map",
    href: "https://wiesnmap.muenchen.de",
    icon: "mapPin",
    section: "settings",
  },

  // Actions Section
  {
    id: "share",
    label: "Share App",
    icon: "share",
    section: "actions",
  },
  {
    id: "signout",
    label: "Sign Out",
    icon: "logOut",
    section: "actions",
  },
];

export const menuSections: MenuSection[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: ["attendance", "groups", "leaderboard", "achievements"],
  },
  {
    id: "settings",
    label: "Settings & Tools",
    items: ["profile", "changeFestival", "map"],
  },
  {
    id: "actions",
    label: "Actions",
    items: ["share", "signout"],
  },
];

export const getMenuItemsBySection = (sectionId: string): MenuItem[] => {
  return menuItems.filter((item) => item.section === sectionId);
};

export const getMenuItemById = (id: string): MenuItem | undefined => {
  return menuItems.find((item) => item.id === id);
};
