import type { Article, ArticleHeader } from "@foundation-like-notion/contracts"
import type { ComponentType } from "react"

export type HeaderRendererProps = Readonly<{
  article: Article
  definition: ArticleHeader
}>

export type HeaderRenderer = ComponentType<HeaderRendererProps>
