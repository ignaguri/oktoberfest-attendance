import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateWrappedShareLinkBodySchema,
  ListWrappedShareLinksResponseSchema,
  PROD_URL,
  ShareCardKindSchema,
  type ShareLang,
  ShareLangSchema,
  WrappedShareLinkSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { ValidationError } from "../middleware/error";
import {
  SupabaseOfficialStatsRepository,
  SupabaseWrappedRepository,
  SupabaseWrappedShareRepository,
} from "../repositories/supabase";
import { WrappedShareService } from "../services/wrapped-share.service";
import { renderShareCard } from "../share-cards/render";

const app = new OpenAPIHono<AuthContext>();

const unauthorized = {
  description: "Unauthorized",
  content: { "application/json": { schema: ApiErrorSchema } },
};

function serviceFor(supabase: AuthContext["Variables"]["supabase"]) {
  return new WrappedShareService(
    new SupabaseWrappedRepository(supabase),
    new SupabaseOfficialStatsRepository(supabase),
    new SupabaseWrappedShareRepository(supabase),
  );
}

/** en links have no prefix, like every other page on the site. */
function shareLinkUrl(
  requestUrl: string,
  token: string,
  lang: ShareLang,
): string {
  const base =
    process.env.VERCEL_ENV === "production"
      ? PROD_URL
      : new URL(requestUrl).origin;
  return `${base}${lang === "en" ? "" : `/${lang}`}/w/${token}`;
}

const CardParamsSchema = z.object({
  festivalId: z.uuid(),
  kind: ShareCardKindSchema,
});

// GET /wrapped/:festivalId/share-cards/:kind - the card as a JPEG. Off the
// OpenAPI spec: its body is binary, and the apps fetch it directly.
app.get("/wrapped/:festivalId/share-cards/:kind", async (c) => {
  const params = CardParamsSchema.safeParse({
    festivalId: c.req.param("festivalId"),
    kind: c.req.param("kind"),
  });
  if (!params.success) {
    throw new ValidationError("Invalid share card request");
  }
  const lang = ShareLangSchema.parse(c.req.query("lang"));
  const { user, supabase } = c.var;
  const card = await serviceFor(supabase).getCard(
    user.id,
    params.data.festivalId,
    params.data.kind,
  );
  const jpeg = await renderShareCard(card, { lang, variant: "story" });
  return c.body(new Uint8Array(jpeg), 200, {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, max-age=3600",
  });
});

const festivalParams = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

const listLinksRoute = createRoute({
  method: "get",
  path: "/wrapped/{festivalId}/share-links",
  tags: ["wrapped"],
  summary: "List the caller's live Wrapped share links",
  request: {
    params: festivalParams,
    query: z.object({ lang: z.string().optional() }),
  },
  responses: {
    200: {
      description: "Live links",
      content: {
        "application/json": { schema: ListWrappedShareLinksResponseSchema },
      },
    },
    401: unauthorized,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listLinksRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const lang = ShareLangSchema.parse(c.req.valid("query").lang);
  const links = await serviceFor(supabase).listLinks(user.id, festivalId);
  return c.json(
    {
      links: links.map((link) => ({
        ...link,
        url: shareLinkUrl(c.req.url, link.token, lang),
      })),
    },
    200,
  );
});

const createLinkRoute = createRoute({
  method: "post",
  path: "/wrapped/{festivalId}/share-links",
  tags: ["wrapped"],
  summary: "Create or reuse the public link for one share card",
  request: {
    params: festivalParams,
    body: {
      content: {
        "application/json": { schema: CreateWrappedShareLinkBodySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "The link",
      content: { "application/json": { schema: WrappedShareLinkSchema } },
    },
    400: {
      description: "Card cannot be linked",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
    401: unauthorized,
    404: {
      description: "Wrapped or card not available",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(createLinkRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const { kind, lang } = c.req.valid("json");
  const token = await serviceFor(supabase).createLink(
    user.id,
    festivalId,
    kind,
  );
  return c.json(
    { kind, token, url: shareLinkUrl(c.req.url, token, lang) },
    200,
  );
});

const revokeLinkRoute = createRoute({
  method: "delete",
  path: "/wrapped/share-links/{token}",
  tags: ["wrapped"],
  summary: "Stop sharing a Wrapped link",
  request: { params: z.object({ token: z.string().min(1) }) },
  responses: {
    200: {
      description: "Revoked",
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
    },
    401: unauthorized,
    404: {
      description: "Link not found",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(revokeLinkRoute, async (c) => {
  const { user, supabase } = c.var;
  const { token } = c.req.valid("param");
  await serviceFor(supabase).revokeLink(user.id, token);
  return c.json({ success: true }, 200);
});

export default app;
