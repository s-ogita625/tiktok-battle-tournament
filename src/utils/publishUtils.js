/**
 * publishUtils.js
 * 公開データを Vercel サーバーレス関数 (/api/publish) 経由で GitHub Gist に保存する。
 *
 * 仕組み:
 *   1. 管理画面が「公開中」の大会を POST /api/publish に送信
 *   2. サーバー側 (api/publish.js) が環境変数 GITHUB_TOKEN の gist スコープを使って
 *      GitHub Gist にデータを保存
 *   3. 返ってきた Gist ID を localStorage に保存
 *   4. 閲覧ページ (ViewerApp.js) が Gist の raw URL から直接データを取得
 *      → Vercel の再デプロイは不要、即座に全デバイスに反映
 *
 * 必要な GitHub Token のスコープ: gist のみ（repo 不要）
 * Classic token で発行してください（Fine-grained token は Gist 非対応）
 */

const GIST_ID_STORAGE_KEY = 'tbt_gist_id'

/** 保存済み Gist ID を取得 */
export function getSavedGistId() {
  try { return localStorage.getItem(GIST_ID_STORAGE_KEY) || '' } catch { return '' }
}

/** Gist ID を localStorage に保存 */
export function saveGistId(id) {
  try { localStorage.setItem(GIST_ID_STORAGE_KEY, id) } catch {}
}

/**
 * 公開対象の大会データを /api/publish に POST する
 * @param {Array} tournaments  isPublic=true の大会配列（空配列も可）
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function publishTournamentData(tournaments) {
  if (!tournaments) tournaments = []

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournaments })
    })

    const data = await res.json().catch(() => ({}))

    if (res.ok && data.ok) {
      // Gist ID を保存（次回から閲覧ページで自動参照）
      if (data.gistId) {
        saveGistId(data.gistId)
      }
      return { ok: true, message: data.message || `✅ ${tournaments.length}件の大会を公開しました！` }
    }

    return {
      ok: false,
      message: data.message || `サーバーエラー (${res.status})`
    }
  } catch (e) {
    return { ok: false, message: `通信エラー: ${e.message}` }
  }
}
