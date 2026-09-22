import type { PresentationConfig } from "@foundation-like-notion/contracts"
import { createContext, type ReactNode, useContext } from "react"
import { defaultPresentation } from "./presentation.js"
import type { ReaderClient } from "./reader-client.js"

export type ReaderMode = "reader" | "demo"

export type ReaderRuntime = Readonly<{
  client: ReaderClient
  mode: ReaderMode
  presentation: PresentationConfig
  storageNamespace: string
}>

const RuntimeContext = createContext<ReaderRuntime | undefined>(undefined)

const unavailableClient: ReaderClient = {
  getPresentation: async () => defaultPresentation,
  getSession: async () => false,
  login: async () => {
    throw new Error("Reader client is unavailable")
  },
  logout: async () => undefined,
  getDatabases: async () => [],
  getArticles: async () => ({ items: [], nextCursor: null }),
  getArticle: async () => {
    throw new Error("Reader client is unavailable")
  },
  searchArticles: async () => ({ items: [], nextCursor: null }),
  assetUrl: () => "",
}

/** Provide validated runtime services to Reader components. / 検証済み runtime service を Reader component に提供します。 */
export function ReaderRuntimeProvider({
  value,
  children,
}: {
  value: ReaderRuntime
  children: ReactNode
}) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

/** Return the active Reader runtime. / 現在の Reader runtime を返します。 */
export function useReaderRuntime(): ReaderRuntime {
  return (
    useContext(RuntimeContext) ?? {
      client: unavailableClient,
      mode: "reader",
      presentation: defaultPresentation,
      storageNamespace: "reader",
    }
  )
}
