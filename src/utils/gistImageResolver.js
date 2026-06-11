/**
 * gistImageResolver.js — 管理画面用 Gist画像オートリゾルバ
 *
 * 背景:
 *   公開時にアップロードされた参加者画像は Gist の RAW URL
 *   (https://gist.githubusercontent.com/.../img-{id}.b64) として保存される。
 *   この .b64 ファイルの中身は data:URL のテキストなので、
 *   <img src=".../img-x.b64"> では画像として表示できない
 *   （閲覧ページは fetch して data:URL に変換する特別処理を持つが、管理画面は持たない）。
 *
 * 役割:
 *   管理画面 DOM 内に現れる「.b64 の Gist URL を src に持つ <img>」を検出し、
 *   その中身を fetch して data:URL に変換し、src を差し替えて表示できるようにする。
 *   MutationObserver で再描画にも追従する。
 *
 * 安全性:
 *   - 表示のみの処理。localStorage や大会データには一切書き込まない。
 *   - 失敗時は何もしない（既存の onerror フォールバック＝イニシャル表示が活きる）。
 */

const _cache = {} // gist .b64 URL → data:URL（取得失敗時は ''）

function isGistB64(url) {
  return !!url && url.includes('gist.githubusercontent.com') && url.includes('.b64')
}

/** .b64 Gist URL を fetch して data:URL を返す（キャッシュ付き） */
export async function resolveGistImageUrl(url) {
  if (!isGistB64(url)) return url || ''
  if (_cache[url] !== undefined) return _cache[url]
  try {
    const res = await fetch(url)
    if (res.ok) {
      const text = (await res.text()).trim()
      const dataUrl = text.startsWith('data:') ? text : `data:image/jpeg;base64,${text}`
      _cache[url] = dataUrl
      return dataUrl
    }
  } catch { /* 無視 */ }
  _cache[url] = ''
  return ''
}

async function resolveImgEl(img) {
  const url = img.getAttribute('data-gist-src') || img.getAttribute('src') || ''
  if (!isGistB64(url)) return
  if (img.dataset.gistResolving === '1') return
  img.dataset.gistResolving = '1'
  const dataUrl = await resolveGistImageUrl(url)
  delete img.dataset.gistResolving
  if (dataUrl) {
    img.src = dataUrl
    img.style.display = ''
    // onerror で表示されたイニシャル（隣接要素）を隠す
    const sib = img.nextElementSibling
    if (sib && sib.classList && sib.classList.contains('avatar-initials')) {
      sib.style.display = 'none'
    }
  }
}

function scan(node) {
  if (!node || node.nodeType !== 1) return
  const imgs = []
  if (node.tagName === 'IMG') imgs.push(node)
  if (node.querySelectorAll) node.querySelectorAll('img').forEach(i => imgs.push(i))
  imgs.forEach(img => {
    const url = img.getAttribute('data-gist-src') || img.getAttribute('src') || ''
    if (isGistB64(url)) resolveImgEl(img)
  })
}

/**
 * root 配下の Gist画像を解決し、以降の DOM 追加も監視して自動解決する。
 * @param {HTMLElement} [root=document.body]
 * @returns {MutationObserver}
 */
export function startGistImageAutoResolver(root = document.body) {
  scan(root)
  const observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.addedNodes) m.addedNodes.forEach(scan)
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return observer
}
