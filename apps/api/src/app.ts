import { Readable } from "node:stream"
import path from "node:path"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import staticFiles from "@fastify/static"
import {
  ReaderEmbeddedTableIdSchema,
  ReaderCursorSchema,
  SearchRequestSchema,
  SessionRequestSchema,
  type ApiError,
} from "@foundation-like-notion/contracts"
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  LogController,
} from "fastify"
import { ZodError, z } from "zod"
import {
  ContentAdapterError,
  type ContentAdapter,
  type SourceAsset,
} from "./adapters/content-adapter.js"
import type { RuntimeConfig } from "./config.js"
import type { CursorRegistry } from "./cursor-registry.js"
import { ReaderDatabase } from "./database.js"
import { MappingError } from "./domain/property-resolver.js"
import type { EmbeddedTableRegistry } from "./embedded-table-registry.js"
import { ReaderNotFoundError, ReaderRequestError, ReaderService } from "./reader-service.js"
import { SessionService, sessionLifetimeSeconds } from "./session-service.js"

const ListQuerySchema = z.object({
  cursor: ReaderCursorSchema.optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

type BuildAppOptions = Readonly<{
  runtime: RuntimeConfig
  adapter: ContentAdapter
  cursorRegistry?: CursorRegistry
  embeddedTableRegistry?: EmbeddedTableRegistry
  logger?: boolean
}>

/**
 * Select the environment-safe session cookie name and attributes.
 * 環境に対して安全な session cookie 名と属性を選択します。
 *
 * Args:
 *   environment: Current runtime environment.
 *
 * Returns:
 *   Cookie name and immutable security attributes.
 */
export function sessionCookiePolicy(environment: RuntimeConfig["environment"]) {
  const production = environment === "production"
  return {
    name: production ? "__Host-reader_session" : "reader_session",
    options: {
      httpOnly: true,
      secure: production,
      sameSite: "strict" as const,
      path: "/",
    },
  }
}

function publicError(request: FastifyRequest, code: string, message: string): ApiError {
  return { error: { code, message, requestId: request.id } }
}

function isSameOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin
  if (!origin) {
    return true
  }
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

/**
 * Build safe fetch options for a resolved upstream asset.
 * 解決済みupstream asset用の安全なfetch optionを組み立てます。
 *
 * Args:
 *   asset: Adapter-resolved asset descriptor. / Adapterが解決したasset descriptor。
 *
 * Returns:
 *   Immutable fetch options. / 変更しないfetch option。
 */
export function assetRequestInit(asset: SourceAsset): RequestInit {
  return {
    ...(asset.fetchProfile === "notion-icon"
      ? {
          headers: {
            Accept: "image/svg+xml,image/*,*/*;q=0.8",
            "User-Agent": "Foundation-Like-Notion/0.1",
          },
        }
      : {}),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  }
}

/**
 * Build the Reader API with explicit adapter and storage dependencies.
 * Adapter と storage dependency を明示して Reader API を構築します。
 *
 * Args:
 *   options: Validated runtime settings and content adapter.
 *
 * Returns:
 *   Configured Fastify application.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: "info",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "password",
                "token",
              ],
              censor: "[REDACTED]",
            },
          },
    logController: new LogController({ disableRequestLogging: true }),
  })
  const database = new ReaderDatabase(options.runtime.databasePath)
  const sessions = new SessionService(database, options.runtime.passwordHash)
  const reader = new ReaderService(
    options.runtime.reader,
    database,
    options.adapter,
    options.cursorRegistry,
    options.embeddedTableRegistry,
  )
  const cookiePolicy = sessionCookiePolicy(options.runtime.environment)
  const cookieName = cookiePolicy.name

  await app.register(cookie)
  await app.register(rateLimit, { global: false })

  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isSameOrigin(request)) {
      await reply
        .code(403)
        .send(publicError(request, "origin_rejected", "Request を確認できませんでした。"))
    }
  })

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff")
    reply.header("Referrer-Policy", "no-referrer")
    reply.header("X-Frame-Options", "DENY")
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    )
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store")
      reply.header("Pragma", "no-cache")
    }
    return payload
  })

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        endpoint: request.routeOptions.url,
        status: reply.statusCode,
        latencyMs: reply.elapsedTime,
      },
      "request completed",
    )
  })

  const requireSession = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    if (sessions.isAuthenticated(request.cookies[cookieName])) {
      return true
    }
    await reply
      .code(401)
      .send(publicError(request, "authentication_required", "ログインが必要です。"))
    return false
  }

  app.get("/api/health", async () => ({ status: "ok", source: options.runtime.reader.source }))

  app.get("/api/presentation", async () => options.runtime.reader.presentation)

  app.get("/manifest.webmanifest", async (_request, reply) => {
    const { brand, theme, locale } = options.runtime.reader.presentation
    reply.header("Content-Type", "application/manifest+json")
    reply.header("Cache-Control", "no-cache")
    return {
      name: brand.name,
      short_name: brand.shortName,
      description: brand.tagline,
      id: "/",
      lang: locale,
      theme_color: theme.colors.background,
      background_color: theme.colors.background,
      display: "standalone",
      start_url: "/",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    }
  })

  app.get("/api/session", async (request) => ({
    authenticated: sessions.isAuthenticated(request.cookies[cookieName]),
  }))

  app.post(
    "/api/session",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const body = SessionRequestSchema.parse(request.body)
      const token = await sessions.login(body.password)
      if (!token) {
        request.log.warn(
          { requestId: request.id, errorCategory: "invalid_credentials" },
          "login failed",
        )
        return reply
          .code(401)
          .send(publicError(request, "invalid_credentials", "Password が正しくありません。"))
      }
      reply.setCookie(cookieName, token, {
        ...cookiePolicy.options,
        maxAge: sessionLifetimeSeconds,
      })
      return reply.code(204).send()
    },
  )

  app.delete("/api/session", async (request, reply) => {
    sessions.logout(request.cookies[cookieName])
    reply.clearCookie(cookieName, cookiePolicy.options)
    reply.header("Clear-Site-Data", '"cache", "cookies"')
    return reply.code(204).send()
  })

  app.get("/api/databases", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    return reader.listDatabases()
  })

  app.get("/api/databases/:readerDatabaseId/articles", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    const params = z.object({ readerDatabaseId: z.string() }).parse(request.params)
    const query = ListQuerySchema.parse(request.query)
    return reader.listArticles(params.readerDatabaseId, query.cursor, query.pageSize)
  })

  app.get("/api/articles/:readerArticleId", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    const params = z.object({ readerArticleId: z.string() }).parse(request.params)
    return reader.getArticle(params.readerArticleId)
  })

  app.get("/api/articles/:readerArticleId/embedded-tables/:tableId", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    const params = z
      .object({ readerArticleId: z.string(), tableId: ReaderEmbeddedTableIdSchema })
      .parse(request.params)
    const query = z.object({ cursor: ReaderCursorSchema }).parse(request.query)
    return reader.getEmbeddedTablePage(params.readerArticleId, params.tableId, query.cursor)
  })

  app.post("/api/search", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    return reader.search(SearchRequestSchema.parse(request.body))
  })

  app.get("/api/assets/:readerAssetId", async (request, reply) => {
    if (!(await requireSession(request, reply))) return
    const params = z.object({ readerAssetId: z.string() }).parse(request.params)
    const asset = await reader.getAsset(params.readerAssetId)
    const response = await fetch(asset.url, assetRequestInit(asset))
    if (!response.ok || !response.body) {
      return reply
        .code(502)
        .send(publicError(request, "asset_unavailable", "File を取得できませんでした。"))
    }
    reply.header("Content-Type", response.headers.get("content-type") ?? "application/octet-stream")
    if (asset.kind === "file") {
      const fileName = (asset.name ?? "download").replaceAll(/[\r\n"\\]/g, "_")
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`)
    }
    return reply.send(Readable.fromWeb(response.body as never))
  })

  if (options.runtime.serveWeb) {
    await app.register(staticFiles, {
      root: path.resolve("apps/web/dist"),
      prefix: "/",
      wildcard: false,
    })
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (options.runtime.serveWeb && !request.url.startsWith("/api/")) {
      return reply.sendFile("index.html")
    }
    return reply.code(404).send(publicError(request, "not_found", "Resource が見つかりません。"))
  })

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ReaderNotFoundError) {
      return reply
        .code(404)
        .send(
          publicError(request, "not_found", "このコンテンツには Reader からアクセスできません。"),
        )
    }
    if (error instanceof ZodError || error instanceof ReaderRequestError) {
      return reply
        .code(400)
        .send(publicError(request, "invalid_request", "Request を確認してください。"))
    }
    if (error instanceof MappingError) {
      request.log.warn({ requestId: request.id, errorCategory: "mapping_error" }, "mapping failed")
      return reply
        .code(422)
        .send(publicError(request, "mapping_error", "記事の表示設定を確認してください。"))
    }
    if (error instanceof ContentAdapterError) {
      const publicFailures = {
        not_found: { status: 404, code: "not_found", message: "Resource が見つかりません。" },
        rate_limited: {
          status: 503,
          code: "upstream_rate_limited",
          message: "Notion が混雑しています。しばらく待って再試行してください。",
        },
        timeout: {
          status: 504,
          code: "upstream_timeout",
          message: "Notion からの応答が時間内に返りませんでした。",
        },
        unavailable: {
          status: 502,
          code: "upstream_unavailable",
          message: "Notion からデータを取得できませんでした。",
        },
      } as const
      const failure = publicFailures[error.category]
      request.log.warn(
        { requestId: request.id, errorCategory: error.category },
        "content adapter failed",
      )
      return reply.code(failure.status).send(publicError(request, failure.code, failure.message))
    }
    request.log.error({ requestId: request.id, errorCategory: "internal_error" }, "request failed")
    return reply
      .code(502)
      .send(
        publicError(request, "upstream_unavailable", "Notion からデータを取得できませんでした。"),
      )
  })

  app.addHook("onClose", async () => {
    database.close()
  })
  return app
}
