import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { defaultPresentation } from "../presentation.js"
import type { ReaderClient } from "../reader-client.js"
import { ReaderRuntimeProvider } from "../reader-runtime.js"
import { ArticleRenderer } from "./ArticleRenderer.js"

afterEach(cleanup)

function testClient(overrides: Partial<ReaderClient> = {}): ReaderClient {
  return {
    getPresentation: async () => defaultPresentation,
    getSession: async () => true,
    login: async () => undefined,
    logout: async () => undefined,
    getDatabases: async () => [],
    getArticles: async () => ({ items: [], nextCursor: null }),
    getArticle: async () => {
      throw new Error("unused")
    },
    getEmbeddedTablePage: async () => ({ rows: [], nextCursor: null }),
    searchArticles: async () => ({ items: [], nextCursor: null }),
    assetUrl: (id: string) => `/api/assets/${id}`,
    ...overrides,
  }
}

function renderer(
  client: ReaderClient,
  articleId = "art_reader_article",
  tableId = `tbl_${"a".repeat(43)}`,
  firstRow = "First",
) {
  return (
    <ReaderRuntimeProvider
      value={{
        client,
        mode: "reader",
        presentation: defaultPresentation,
        storageNamespace: "reader",
      }}
    >
      <ArticleRenderer
        articleId={articleId}
        blocks={[
          {
            type: "callout",
            color: "blue_background",
            icon: { kind: "asset", assetId: "asset_reader_icon" },
            content: [{ text: "Important" }],
            children: [{ type: "paragraph", content: [{ text: "Nested detail" }] }],
          },
          {
            type: "embeddedDatabase",
            title: "Notebook",
            tables: [
              {
                status: "available",
                tableId,
                title: "Notebook",
                columns: ["Name", "Result"],
                rows: [[firstRow, "10"]],
                nextCursor: `cur_${"b".repeat(43)}`,
              },
            ],
          },
        ]}
      />
    </ReaderRuntimeProvider>
  )
}

function renderWithClient(client: ReaderClient) {
  return render(renderer(client))
}

describe("ArticleRenderer", () => {
  it("renders styled nested callouts with proxied icons", () => {
    const client = testClient()
    const { container } = renderWithClient(client)
    expect(screen.getByText("Important")).toBeInTheDocument()
    expect(screen.getByText("Nested detail")).toBeInTheDocument()
    expect(screen.getAllByText("Notebook")).toHaveLength(1)
    expect(container.querySelector(".callout-blue_background")).not.toBeNull()
    expect(container.querySelector("img")).toHaveAttribute("src", "/api/assets/asset_reader_icon")
  })

  it("appends embedded-table rows through the Reader client", async () => {
    const load = vi.fn().mockResolvedValueOnce({ rows: [["Second", "20"]], nextCursor: null })
    const client = testClient({ getEmbeddedTablePage: load })
    renderWithClient(client)
    await userEvent.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByText("Second")).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith(
      "art_reader_article",
      `tbl_${"a".repeat(43)}`,
      `cur_${"b".repeat(43)}`,
    )
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("shows a reload instruction when an embedded-table cursor expires", async () => {
    const client = testClient({
      getEmbeddedTablePage: vi.fn().mockRejectedValue(new Error("expired")),
    })
    renderWithClient(client)
    await userEvent.click(screen.getByRole("button", { name: "Load more" }))
    expect(
      await screen.findByText("Reload the article to continue this table."),
    ).toBeInTheDocument()
  })

  it("resets embedded-table state when navigating to another article", () => {
    const client = testClient()
    const { rerender } = render(renderer(client))
    expect(screen.getByText("First")).toBeInTheDocument()

    rerender(renderer(client, "art_second_article", `tbl_${"c".repeat(43)}`, "Second article"))

    expect(screen.queryByText("First")).not.toBeInTheDocument()
    expect(screen.getByText("Second article")).toBeInTheDocument()
  })
})
