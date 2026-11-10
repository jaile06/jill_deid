# 第三方檔案來源（spec §4）

版本以上游 `package-lock.json`（commit `1f7b9298`）為準，由 npm registry 以 `npm pack` 下載一次，原樣放入，勿手改。
pdfjs-dist 的 `.mjs` 存檔時改為 `.js`，避免 Apache 回錯 MIME。

| 檔案 | 套件 | 來源 | SHA-256 |
|---|---|---|---|
| `assets/vendor/jszip.min.js` | `jszip@3.10.1` | https://unpkg.com/jszip@3.10.1/dist/jszip.min.js | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| `assets/vendor/fontkit.umd.min.js` | `@pdf-lib/fontkit@1.1.1` | https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js | `d8df561b9fba98e24f2e5130e40948809281bbbc55a20c412359f1a0a5eb35a6` |
| `assets/vendor/libphonenumber-min.js` | `libphonenumber-js@1.13.15` | https://unpkg.com/libphonenumber-js@1.13.15/bundle/libphonenumber-min.js | `47a1ff6bec42ee76977c3fb706f7708fc3513dfcb16b341fee220dcfc1e8723b` |
| `assets/vendor/pdf-lib.esm.min.js` | `pdf-lib@1.17.1` | https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js | `72c052d97b4d5d9fa6cdbdcb7ad709f03d4ddb1122390cb3afeba4d88651d969` |
| `assets/vendor/pdf.min.js` | `pdfjs-dist@4.10.38` | https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.min.mjs | `27fc2a057a00f92a4334ad06e17dbd7259912954e9fb7f76400bcca5fd190a9c` |
| `assets/vendor/pdf.worker.min.js` | `pdfjs-dist@4.10.38` | https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs | `1baa1844c89c80a5b2797c916e75ab29254be46d8e9cb53cb6364d7aad84be36` |
| `assets/vendor/tesseract.esm.min.js` | `tesseract.js@7.0.0` | https://unpkg.com/tesseract.js@7.0.0/dist/tesseract.esm.min.js | `64871d76c75609fd5413b88a8171e2ef40deedd77d5875ba23df104b2d05eb29` |
| `assets/ocr/worker.min.js` | `tesseract.js@7.0.0` | https://unpkg.com/tesseract.js@7.0.0/dist/worker.min.js | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `assets/ocr/core/tesseract-core-lstm.wasm.js` | `tesseract.js-core@7.0.0` | https://unpkg.com/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js | `eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680` |
| `assets/ocr/core/tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@7.0.0` | https://unpkg.com/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `assets/ocr/core/tesseract-core-relaxedsimd-lstm.wasm.js` | `tesseract.js-core@7.0.0` | https://unpkg.com/tesseract.js-core@7.0.0/tesseract-core-relaxedsimd-lstm.wasm.js | `861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3` |
| `assets/ocr/lang/chi_tra.traineddata.gz` | `@tesseract.js-data/chi_tra@1.0.0` | https://unpkg.com/@tesseract.js-data/chi_tra@1.0.0/4.0.0_best_int/chi_tra.traineddata.gz | `11fe2610dab05d8a880d02f193ce70203f4c4bbe061b987d5529a2c038a22743` |
| `assets/ocr/lang/eng.traineddata.gz` | `@tesseract.js-data/eng@1.0.0` | https://unpkg.com/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |

## 取自上游 repo

來源 https://github.com/dean9703111/data-deidentification/tree/1f7b9298f94a9728cf6d181f84cfcce48c39d968

| 檔案 | 來源 | SHA-256 |
|---|---|---|
| `assets/fonts/NotoSansTC-Regular.ttf` | 上游 `public/fonts/NotoSansTC-Regular.ttf` | `add35d53f70727657b4509531677c4e3712b67df3d54661efdee5d3a0c16d954` |
| `assets/samples/contract.deid.docx` | 上游 `public/samples/contract.deid.docx` | `352517668507d0e02e806fbc633a565da27a8e5309c2c2fa1974166fc17284f1` |
| `assets/samples/contract.docx` | 上游 `public/samples/contract.docx` | `6ad438cfefb080f415d12de8eaf488db078db4976342c0189706ace5954957a1` |
| `assets/samples/contract.mapping.csv` | 上游 `public/samples/contract.mapping.csv` | `fb78424d5b349bb4b9cb700ca9319a030128424b2651db125afb50e00eb39068` |
| `assets/samples/contract.pdf` | 上游 `public/samples/contract.pdf` | `00e49f54fd6aec7e3b50e4602a5eb64bf34f5fcedb2888cbbe4be0f6190e361c` |
| `assets/samples/customers.xlsx` | 上游 `public/samples/customers.xlsx` | `21d77eaefbda366a69ceb02c855be2feab85a14069c46d0785558dca7b1c27cf` |
| `assets/samples/meeting-notes.md` | 上游 `public/samples/meeting-notes.md` | `5ee95a6b2851611448dfd9cafa00002895593ec28f8803f2fd39874724c6e172` |
| `assets/samples/quotation.docx` | 上游 `public/samples/quotation.docx` | `1d4fad8c75d37ab8fc219d9e72bd7a6a41f82ac4d9a86c6d7c82ff04c596f575` |
| `assets/samples/quotation.pdf` | 上游 `public/samples/quotation.pdf` | `8aed6c828eeb189742ae0b6573077aa8a285b286db1d6c0dd1b79bbeb36c084b` |
| `assets/samples/scanned.pdf` | 上游 `public/samples/scanned.pdf` | `308b65cfefe1b9d5a7d24db7a638326caf243509930603f6032681347c756b54` |
| `assets/samples/support-email.txt` | 上游 `public/samples/support-email.txt` | `799850180bc2f036b94afddf92eef16281703cc36609636ec2a740a9704436f0` |

`assets/css/jill-deid-app.css` 由上游 `src/styles.css` 複製；`assets/js/upstream/` 由 `tools/strip-upstream.mjs` 轉換自上游 `src/`。