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
  Sparkles,
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

export const menuItems: MenuItem[] = [
  // Navigation Section
  {
    id: "attendance",
    label: "My Attendances",
    href: "/attendance",
    icon: <Calendar className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "groups",
    label: "Groups",
    href: "/groups",
    icon: <Users className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "leaderboard",
    label: "Global Leaderboard",
    href: "/leaderboard",
    icon: <Trophy className="h-4 w-4" />,
    section: "navigation",
  },
  {
    id: "achievements",
    label: "Achievements",
    href: "/achievements",
    icon: <Medal className="h-4 w-4" />,
    section: "navigation",
  },

  // Settings Section
  {
    id: "profile",
    label: "Profile Settings",
    href: "/profile",
    icon: <User className="h-4 w-4" />,
    section: "settings",
  },
  {
    id: "map",
    label: "Festival Map",
    href: "https://wiesnmap.muenchen.de",
    icon: <MapPin className="h-4 w-4" />,
    section: "settings",
  },
  {
    id: "whatsNew",
    label: "See What's New",
    icon: <Sparkles className="h-4 w-4" />,
    section: "settings",
  },

  // Actions Section
  {
    id: "changeFestival",
    label: "Change Festival",
    icon: <CalendarSync className="h-4 w-4" />,
    section: "actions",
  },
  {
    id: "share",
    label: "Share App",
    icon: <Share2 className="h-4 w-4" />,
    section: "actions",
  },
  {
    id: "signout",
    label: "Sign Out",
    icon: <LogOut className="h-4 w-4" />,
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
    items: ["profile", "map", "whatsNew"],
  },
  {
    id: "actions",
    label: "Actions",
    items: ["changeFestival", "share", "signout"],
  },
];

export const getMenuItemsBySection = (sectionId: string): MenuItem[] => {
  return menuItems.filter((item) => item.section === sectionId);
};

export const getMenuItemById = (id: string): MenuItem | undefined => {
  return menuItems.find((item) => item.id === id);
};
