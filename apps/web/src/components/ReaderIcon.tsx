import type { ReaderIcon as ReaderIconValue } from "@foundation-like-notion/contracts"
import { useReaderRuntime } from "../reader-runtime.js"

/** Render a Reader-owned emoji or proxied asset icon. / Reader 所有の emoji または proxy asset icon を描画します。 */
export function ReaderIcon({ icon }: { icon: ReaderIconValue | undefined }) {
  const runtime = useReaderRuntime()
  if (!icon) return null
  if (icon.kind === "emoji") {
    return <span aria-hidden="true">{icon.value}</span>
  }
  const src = runtime.client.assetUrl(icon.assetId)
  return <img className="reader-icon-image" src={src} alt="" />
}
