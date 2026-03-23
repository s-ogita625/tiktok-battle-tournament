/**
 * publishUtils.js
 * 公開データ（閲覧ページ用）を Vercel サーバーレス関数 (/api/publish) 経由で更新する。
 *
 * 仕組み:
 *   1. 管理画面が「公開中」の大会を POST /api/publish に送信
 *   2. サーバー側 (api/publish.js) が環境変数の GITHUB_TOKEN を使って
 *      public/tournament-data.json を GitHub に push
 *   3. Vercel が自動デプロイ → 閲覧ページに反映（約1〜2分）
 *
 * ブラウザ側に GitHub Token は不要。
 * どのデバイスからでも操作できる。
 */

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
      return { ok: true, message: data.message || `✅ ${tournaments.length}件の大会を公開しました！` }
    }

    // エラー時
    return {
      ok: false,
      message: data.message || `サーバーエラー (${res.status})`
    }
  } catch (e) {
    return { ok: false, message: `通信エラー: ${e.message}` }
  }
}
