/**
 * publishUtils.js
 * 公開データ（閲覧ページ用）を GitHub の public/tournament-data.json に書き込む
 *
 * 仕組み:
 *   1. 管理画面の「公開データを更新」ボタンを押す
 *   2. isPublic=true の大会だけを抽出して JSON を生成
 *   3. GitHub Contents API (PUT) でファイルを更新
 *   4. Vercel が自動デプロイ → 閲覧ページに反映
 *
 * 必要なもの:
 *   - GitHub Personal Access Token (repo スコープ)
 *     Settings → Developer settings → Personal access tokens → Fine-grained tokens
 *     または Classic token で repo にチェック
 */

const GITHUB_OWNER = 's-ogita625'
const GITHUB_REPO  = 'tiktok-battle-tournament'
const GITHUB_FILE  = 'public/tournament-data.json'
const GITHUB_BRANCH = 'main'
const TOKEN_STORAGE_KEY = 'tbt_github_token'

/** localStorageに保存されたGitHub Tokenを取得 */
export function getSavedToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) || '' } catch { return '' }
}

/** GitHub TokenをlocalStorageに保存 */
export function saveToken(token) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token.trim()) } catch {}
}

/**
 * 公開対象の大会データを public/tournament-data.json に push する
 * @param {Array} tournaments  isPublic=true の大会配列
 * @param {string} token       GitHub Personal Access Token
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function publishTournamentData(tournaments, token) {
  if (!token) return { ok: false, message: 'GitHub Tokenが設定されていません' }
  // tournaments が空でも「全て非公開」として空配列を push できるようにする
  if (!tournaments) tournaments = []

  // 売上情報を除いた公開用データを生成
  const publicData = {
    updatedAt: new Date().toISOString(),
    tournaments: tournaments.map(t => ({
      id:               t.id,
      title:            t.title,
      createdAt:        t.createdAt,
      stage:            t.stage,
      isPublic:         true,
      settings:         t.settings,
      // 参加者は売上を除外
      participants: (t.participants || []).map(p => ({
        id:              p.id,
        name:            p.name,
        tiktokUrl:       p.tiktokUrl || '',
        profileImageUrl: p.profileImageUrl || '',
        groupId:         p.groupId || null,
        availableDates:             p.availableDates || [],
        unavailableDates:           p.unavailableDates || [],
        tournamentAvailableDates:   p.tournamentAvailableDates || [],
        tournamentUnavailableDates: p.tournamentUnavailableDates || []
      })),
      groups:            t.groups || [],
      tournamentBracket: t.tournamentBracket || null
    }))
  }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(publicData, null, 2))))

  // 現在のファイルのSHAを取得（更新に必要）
  let sha = ''
  try {
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}?ref=${GITHUB_BRANCH}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    )
    if (getRes.ok) {
      const getJson = await getRes.json()
      sha = getJson.sha || ''
    }
  } catch (e) {
    return { ok: false, message: `GitHub APIへの接続に失敗しました: ${e.message}` }
  }

  // ファイルを更新
  try {
    const body = {
      message: `公開データ更新: ${new Date().toLocaleString('ja-JP')}`,
      content,
      branch: GITHUB_BRANCH,
      ...(sha ? { sha } : {})
    }
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )

    if (putRes.ok) {
      return { ok: true, message: `✅ ${tournaments.length}件の大会を公開しました！\nVercelが自動デプロイを開始します（約1〜2分で反映）` }
    } else {
      const errJson = await putRes.json().catch(() => ({}))
      if (putRes.status === 401) return { ok: false, message: 'Token認証エラー: Tokenを確認してください' }
      if (putRes.status === 403) return { ok: false, message: '権限エラー: TokenにRepoのWrite権限があるか確認してください' }
      return { ok: false, message: `GitHub APIエラー (${putRes.status}): ${errJson.message || '不明なエラー'}` }
    }
  } catch (e) {
    return { ok: false, message: `通信エラー: ${e.message}` }
  }
}
