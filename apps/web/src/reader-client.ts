import type {
  Article,
  ArticlePage,
  DatabaseSummary,
  EmbeddedTablePage,
  PresentationConfig,
  SearchRequest,
} from "@foundation-like-notion/contracts"

/** Abstract Reader data access for HTTP and static demo runtimes. / HTTP と静的 demo の Reader data access を抽象化します。 */
export type ReaderClient = Readonly<{
  getPresentation(): Promise<PresentationConfig>
  getSession(): Promise<boolean>
  login(password: string): Promise<void>
  logout(): Promise<void>
  getDatabases(): Promise<DatabaseSummary[]>
  getArticles(databaseId: string, cursor?: string): Promise<ArticlePage>
  getArticle(articleId: string): Promise<Article>
  getEmbeddedTablePage(
    articleId: string,
    tableId: string,
    cursor: string,
  ): Promise<EmbeddedTablePage>
  searchArticles(value: SearchRequest): Promise<ArticlePage>
  assetUrl(assetId: string): string
}>
