# Header renderer guide

Article headerはYAMLから任意HTMLを読み込まず、bundle済みのtrusted renderer registryだけを使用します。この境界により、利用者はfield・label・順番・配置をYAMLで安全に変更でき、開発者は新しい見た目を小さな差分で追加できます。

## 設定だけで変更できる範囲

- `field-grid`: fieldの順番、label、`third` / `half` / `full`幅、通常/強調、icon有無、密度、tone
- `compact-emblem`: emblem variable、headline variable、title fallback、metadata fields
- 共通: template表示名、記事titleの `header` / `content` 配置とalignment

記事に値がないfieldは隙間を残さず省略されます。一方、YAMLが存在しないReader variableを参照すると、起動時validationが失敗します。

## 新しいrendererを追加する手順

1. `packages/contracts/src/index.ts` の `ArticleHeaderSchema` discriminated unionへ新しいrenderer設定branchを追加します。任意HTML、script、生CSS、外部URLは受け付けないschemaにします。
2. `apps/web/src/components/article-headers/` にReact componentとCSS Moduleのclassを追加します。共通の `HeaderTitle`、`HeaderField`、`ReaderIcon`、ReaderValue formatterを再利用します。
3. `registry.ts` の `renderers` へcomponentを登録します。`ArticlePage`、Reader Service、公開endpointへrenderer固有分岐を追加しません。
4. `config/reader.example.yaml` に安全な例を追加します。
5. component testでfield順序、欠損値、title placement、mobile reflow、reduced motionを確認します。config testで未知variableと無効設定が起動時に拒否されることも確認します。

最小componentは次の形です。

```tsx
import type { HeaderRendererProps } from "./types.js"

export function NewHeader({ article, definition }: HeaderRendererProps) {
  return <header>{/* validated definitionだけを描画する */}</header>
}
```

rendererが未登録の状態はTypeScriptのregistry型検査で検出します。runtimeで未知template IDを受け取った場合はbuilt-in `simple`へ安全にfallbackしますが、正常なReader YAMLやdemo YAMLの未知template参照はbuild/起動時に拒否されます。
