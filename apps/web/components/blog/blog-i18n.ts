import type { BlogCategory, BlogLocale } from "@/lib/blog";

export const categoryNames: Record<BlogCategory, Record<BlogLocale, string>> = {
  festivals: { en: "Festivals", de: "Feste", es: "Festivales" },
  tips: { en: "Tips", de: "Tipps", es: "Consejos" },
  culture: { en: "Culture", de: "Kultur", es: "Cultura" },
  news: { en: "News", de: "Neuigkeiten", es: "Noticias" },
};

const tagNames: Record<string, Record<BlogLocale, string>> = {
  oktoberfest: { en: "Oktoberfest", de: "Oktoberfest", es: "Oktoberfest" },
  "first time": { en: "First time", de: "Erstbesucher", es: "Primera vez" },
  "beginners guide": {
    en: "Beginners guide",
    de: "Einsteiger-Guide",
    es: "Guía para principiantes",
  },
  munich: { en: "Munich", de: "München", es: "Múnich" },
  "beer festival": {
    en: "Beer festival",
    de: "Bierfest",
    es: "Festival cervecero",
  },
  tips: { en: "Tips", de: "Tipps", es: "Consejos" },
  dates: { en: "Dates", de: "Termine", es: "Fechas" },
  "beer prices": {
    en: "Beer prices",
    de: "Bierpreise",
    es: "Precios de cerveza",
  },
  tents: { en: "Tents", de: "Zelte", es: "Carpas" },
  reservations: {
    en: "Reservations",
    de: "Reservierungen",
    es: "Reservas",
  },
  budget: { en: "Budget", de: "Budget", es: "Presupuesto" },
  costs: { en: "Costs", de: "Kosten", es: "Costes" },
  "beer halls": {
    en: "Beer halls",
    de: "Bierhallen",
    es: "Cervecerías",
  },
  traditions: {
    en: "Traditions",
    de: "Traditionen",
    es: "Tradiciones",
  },
  customs: { en: "Customs", de: "Bräuche", es: "Costumbres" },
  "drinking games": {
    en: "Drinking games",
    de: "Trinkspiele",
    es: "Juegos de beber",
  },
  culture: { en: "Culture", de: "Kultur", es: "Cultura" },
  starkbierfest: {
    en: "Starkbierfest",
    de: "Starkbierfest",
    es: "Starkbierfest",
  },
  "strong beer": {
    en: "Strong beer",
    de: "Starkbier",
    es: "Cerveza fuerte",
  },
  doppelbock: { en: "Doppelbock", de: "Doppelbock", es: "Doppelbock" },
  "spring festival": {
    en: "Spring festival",
    de: "Frühlingsfest",
    es: "Festival de primavera",
  },
  fruehlingsfest: {
    en: "Frühlingsfest",
    de: "Frühlingsfest",
    es: "Frühlingsfest",
  },
  calendar: { en: "Calendar", de: "Kalender", es: "Calendario" },
  news: { en: "News", de: "Neuigkeiten", es: "Noticias" },
  "2026": { en: "2026", de: "2026", es: "2026" },
  regulations: {
    en: "Regulations",
    de: "Vorschriften",
    es: "Regulaciones",
  },
};

export function localizeCategory(category: string, locale: BlogLocale): string {
  return (
    categoryNames[category as BlogCategory]?.[locale] ??
    category.charAt(0).toUpperCase() + category.slice(1)
  );
}

export function localizeTag(tag: string, locale: BlogLocale): string {
  return tagNames[tag]?.[locale] ?? tag;
}
