# 網址內的標記與還原（合約，spec §5.1–§5.3）

實作：`assets/js/jill/uri-scan.js`；測試：`tests/browser/uri.test.js`。本文件與實作不一致時，以 spec 為準並同步修正兩者。

## 1. 兩種位置

| 位置 | 例子 | 標記寫法 | 還原者 |
|---|---|---|---|
| 連結目標（URI 位置） | DOCX rels 的 `Target`、`HYPERLINK "…"`、XLSX `HYPERLINK()`、Markdown `(…)`、PDF `/URI` | `encodeURIComponent('[類別:code]')`，例：`%5B%E8%BA%AB%E5%88%86%E8%AD%89%3A7b21e8%5D` | `restoreUri()` |
| 文字層裸網址 | 內文直接出現的 `https://…` | 未編碼的 `[類別:code]`，與一般內文相同 | 上游 `restore()` |

兩者共用同一份 `CodeBook`：同一個值在內文與網址裡得到同一個編碼（H5）。

## 2. 連結目標：`scanUri(uri, patterns, book, opts)`

`opts`：`retentionOf(cand)`（目前輸出模式下的保留方式，預設用規則自己的）、`hyperlinkMode`、`markerStyle`。

1. **個人頁（規則 `url`，類別 `網址`）先比對整條 URI**。命中就把隱藏部分以**原始位元組**換成編碼標記，不再拆組件。部分保留時保留到網站根 `/`（`https://www.facebook.com/` + 標記）。
2. 沒有命中個人頁才逐組件掃描，掃描字串依 spec §5.1 表：
   - userinfo、host、path 每段、fragment：解碼後整段。
   - query：`?key=` 或 `&key=` 當上下文接在值前面一起掃，命中與值有交集才算，只替換值內的區段。
   - `mailto:`：收件者以 `,` 切開；`?cc=` 等比照 query。
   - `tel:`：冒號後整段。
   - query 的 `+` 當空白。
3. 命中的組件**整段重新編碼**（`encodeURIComponent`；`mailto` 保留 `@`，`tel` 保留 `+`）；未命中的組件位元組不動。
4. **解碼失敗**（`URIError`，Big5、截斷的 `%E7%8E`）：該組件值整段以類別 `網址` 隱藏，`original` 存原始位元組，警示 `undecodable`（fail closed）。
5. **host 命中**：host 放不下標記，整個連結 `strip`，`unrestorable: true`，警示 `host`。
6. `markerStyle` 不是 `code`，或 `hyperlinkMode` 為 `strip_link`：有命中的連結一律 `strip`。前者另警示 `marker`（spec §5.4）。
7. 沒有命中的連結：`action: 'keep'`，URI 原樣。

回傳 `LinkDecision`：

```js
{ action: 'keep' | 'rewrite' | 'strip', uri?, hits: LinkHit[], warnings: ('undecodable'|'host'|'marker')[], unrestorable }
```

`LinkHit` 就是對照表（CSV）的一列：`{ code, category, original, prefix?, suffix? }`。`original` 是隱藏的部分，一般類別存解碼後的值，`網址` 存原始字串。保留的 `prefix`、`suffix` 照常留在 URI 中（已編碼）。警示是代碼，介面文字由 `ui/` 修補提供（spec §4 i18n）。

## 3. 還原：`restoreUri(uri, mapping)`

直接對 URI 字串套用，不拆組件：

```
/%5B((?:(?!%5B|%5D|%3A).){1,90}?)%3A([0-9a-f]{6})%5D/gi
```

依編碼查表：類別 `網址` 原樣寫回（否則 `/` 會變成 `%2F`），其他類別寫回 `encodeURIComponent(original)`。查無編碼就保留標記，列入 `missingCodes`。

**一致性**：還原後的 URI 與原 URI 經 `decodeURIComponent` 正規化後相同；只有被隱藏的區段，編碼大小寫、`+` 與 `%20` 可能不同。`網址` 與解碼失敗的值逐位元組相同（H13）。

## 4. 文字層裸網址（spec §5.3 例外）

- 規則 `url` 在一般內文偵測中照常命中；部分保留時同樣保留到網站根（H26）。
- 裸網址中**含 `%` 的組件**，一般內文掃描看不到編碼後的個資。Worker 對每條規則另外解碼這些組件掃描（`encodedTextCandidates`），命中時候選為**整段原始編碼字串**。
- 無法解碼的組件由主執行緒補成 `網址` 候選（`brokenTextCandidates`）。
- 以上兩種候選帶 `fixed`：任何輸出模式下都整段隱藏，不切保留字元。這樣 offset 不會錯，還原時逐位元組回到原字串。

## 5. 規則 `url` 與個人頁清單

- 清單來自模組設定「個人頁網址清單」（`Config.urlPersonalHosts`）。`main.js` 以 `setPersonalHosts()` 設定，detect 時隨訊息帶給 Worker。
- 每行格式 `domain[/pathPrefix]`：domain 以尾端比對（含 `www.`、`m.`），pathPrefix 以路徑開頭比對，且須到 `/` 為界（`linkedin.com/in` 不含 `/inbox`）。
- 裸網址只收 RFC 3986 的字元。中文句子常緊接網址而不空格，所以非 ASCII 字元不算網址的一部分；尾端的 `.,;:!?')]` 歸句子。
- 清單外的網址不整條命中，只做 §2 的組件掃描（在連結目標中）。

## 6. 不涵蓋

雙重編碼（`%25E7…`）、Base64、自訂編碼的參數值（spec §9.4 已知不涵蓋）。
