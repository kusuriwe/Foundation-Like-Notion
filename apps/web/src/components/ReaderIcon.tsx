import type { ReaderIcon as ReaderIconValue } from "@foundation-like-notion/contracts"

/** Render a Reader-owned emoji or proxied asset icon. / Reader 所有の emoji または proxy asset icon を描画します。 */
export function ReaderIcon({ icon }: { icon: ReaderIconValue | undefined }) {
  if (!icon) return null
  if (icon.kind === "emoji") {
    return <span aria-hidden="true">{icon.value}</span>
  }
  return <img className="reader-icon-image" src={`/api/assets/${icon.assetId}`} alt="" />
}
