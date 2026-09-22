import type { Article, ArticleHeader } from "@foundation-like-notion/contracts"
import { useReaderRuntime } from "../reader-runtime.js"
import { headerRenderer, resolveHeaderDefinition } from "./article-headers/registry.js"
import { displayValue } from "./article-headers/shared.js"

/** Render an article header using an allowlisted bundled template. / 許可された同梱 template で article header を描画します。 */
export function TemplateHeader({ article, templateId }: { article: Article; templateId: string }) {
  const { presentation } = useReaderRuntime()
  const definition = resolveHeaderDefinition(presentation.articleHeaders, templateId)
  const Renderer = headerRenderer(definition)
  return <Renderer article={article} definition={definition} />
}

/** Return the safe title placement for one selected template. / 選択templateの安全なtitle配置を返します。 */
export function templateTitlePlacement(
  definitions: Readonly<Record<string, ArticleHeader>>,
  templateId: string,
  article?: Article,
): "header" | "content" {
  const definition = resolveHeaderDefinition(definitions, templateId)
  if (
    article &&
    (definition.renderer === "compact-emblem" || definition.renderer === "cactus-study") &&
    !displayValue(article.variables[definition.headlineVariable])
  ) {
    return "header"
  }
  return definition.title.placement
}
