import { z } from "zod";

import { SUPPORTED_LANGUAGES } from "../i18n/core";
import {
  LINKABLE_SHARE_CARD_KINDS,
  SHARE_CARD_KINDS,
} from "../wrapped/share/types";

/** Anything unknown renders in English rather than failing. */
export const ShareLangSchema = z.enum(SUPPORTED_LANGUAGES).catch("en");
export type ShareLang = z.infer<typeof ShareLangSchema>;

export const ShareCardKindSchema = z.enum(SHARE_CARD_KINDS);
export const LinkableShareCardKindSchema = z.enum(LINKABLE_SHARE_CARD_KINDS);

export const WrappedShareLinkSchema = z.object({
  kind: LinkableShareCardKindSchema,
  token: z.string(),
  url: z.string(),
});
export type WrappedShareLink = z.infer<typeof WrappedShareLinkSchema>;

export const ListWrappedShareLinksResponseSchema = z.object({
  links: z.array(WrappedShareLinkSchema),
});
export type ListWrappedShareLinksResponse = z.infer<
  typeof ListWrappedShareLinksResponseSchema
>;

export const CreateWrappedShareLinkBodySchema = z.object({
  kind: LinkableShareCardKindSchema,
  lang: ShareLangSchema,
});
export type CreateWrappedShareLinkBody = z.infer<
  typeof CreateWrappedShareLinkBodySchema
>;
