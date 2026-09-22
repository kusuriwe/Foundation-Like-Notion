import type { ArticleHeader } from "@foundation-like-notion/contracts"
import { defaultPresentation } from "../../presentation.js"
import { CactusStudyHeader } from "./CactusStudyHeader.js"
import { CompactEmblemHeader } from "./CompactEmblemHeader.js"
import { FieldGridHeader } from "./FieldGridHeader.js"
import type { HeaderRenderer } from "./types.js"

const renderers = {
  "field-grid": FieldGridHeader,
  "compact-emblem": CompactEmblemHeader,
  "cactus-study": CactusStudyHeader,
} satisfies Readonly<Record<ArticleHeader["renderer"], HeaderRenderer>>

/** Return a trusted renderer for one validated header definition. / 検証済みheader定義に対応するtrusted rendererを返します。 */
export function headerRenderer(definition: ArticleHeader): HeaderRenderer {
  return renderers[definition.renderer]
}

/** Resolve a template definition with a safe built-in fallback. / 安全な組み込みfallback付きでtemplate定義を解決します。 */
export function resolveHeaderDefinition(
  definitions: Readonly<Record<string, ArticleHeader>>,
  templateId: string,
): ArticleHeader {
  const fallback = defaultPresentation.articleHeaders.simple
  if (!fallback) throw new Error("Default article header is unavailable")
  return definitions[templateId] ?? fallback
}
