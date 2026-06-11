/**
 * imageUtils.js — 画像圧縮ユーティリティ
 *
 * 目的:
 *   プロフィール画像を base64 (data:URL) のまま、サイズだけを縮小する。
 *   localStorage(約5MB上限) の枯渇による保存失敗を防ぐのが狙い。
 *
 * 重要:
 *   - データ形式は変えない（"data:image/...;base64,..." のまま）。
 *     → 管理画面 / 閲覧ページ / 公開処理のいずれも改修不要で互換。
 *   - 失敗時・非data:URL時は必ず「元の値」をそのまま返す（データを壊さない）。
 */

/** data:URL 文字列の localStorage 上の概算バイト数 */
export function dataUrlByteSize(str) {
  if (!str) return 0
  try { return new Blob([str]).size } catch { return str.length }
}

/** バイト数を人間可読な文字列に */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/**
 * data:URL 画像をリサイズ＋再エンコードして縮小する。
 *
 * @param {string} dataUrl   "data:image/...;base64,..." 形式の文字列
 * @param {object} [opts]
 * @param {number} [opts.maxSize=512]  長辺の最大px
 * @param {number} [opts.quality=0.82] JPEG品質 (0〜1)
 * @returns {Promise<string>} 縮小後の data:URL（失敗時/非対象時は元の dataUrl）
 */
export function compressImageDataUrl(dataUrl, opts = {}) {
  const { maxSize = 512, quality = 0.82 } = opts
  return new Promise((resolve) => {
    // data: 画像でなければ何もしない（外部URL・空文字などはそのまま）
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl)
    }
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        if (!width || !height) return resolve(dataUrl)

        // 長辺を maxSize に収まるよう縮小（拡大はしない）
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        // 透過PNG→JPEG時の黒つぶれ防止に白背景を敷く
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)

        const out = canvas.toDataURL('image/jpeg', quality)
        // 念のため: 縮小後が元より大きい/不正なら元を返す
        if (out && out.startsWith('data:image') && out.length < dataUrl.length) {
          resolve(out)
        } else {
          resolve(dataUrl)
        }
      } catch {
        resolve(dataUrl) // 何があっても元データを守る
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
