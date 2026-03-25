/**
 * api/gist-id.js — Gist ID を返すエンドポイント
 *
 * 取得の優先順位:
 *   1. 環境変数 GIST_ID が設定されていればそれを返す（最速・キャッシュ）
 *   2. 未設定の場合、GitHub API で GIST_OWNER のパブリック Gist から
 *      description が "TikTokBattleTournament-Public" のものを検索して返す
 *
 * GIST_OWNER は環境変数で指定（デフォルト: s-ogita625）
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  // 1. 環境変数に直接設定されている場合はそれを返す
  const envGistId = process.env.GIST_ID || ''
  if (envGistId) {
    return res.status(200).json({ gistId: envGistId })
  }

  // 2. GitHub API でパブリック Gist を description で検索
  const owner = process.env.GIST_OWNER || 's-ogita625'
  const token = process.env.GITHUB_TOKEN || ''

  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TikTokBattleTournament'
    }
    if (token) headers.Authorization = `Bearer ${token}`

    // ユーザーの Gist 一覧を最大100件取得して description で探す
    const apiRes = await fetch(
      `https://api.github.com/users/${owner}/gists?per_page=100`,
      { headers }
    )
    if (!apiRes.ok) {
      return res.status(200).json({ gistId: '', error: `GitHub API error: ${apiRes.status}` })
    }

    const gists = await apiRes.json()
    const found = Array.isArray(gists)
      ? gists.find(g => g.description === 'TikTokBattleTournament-Public')
      : null

    if (found) {
      return res.status(200).json({ gistId: found.id })
    }

    return res.status(200).json({ gistId: '' })
  } catch (e) {
    return res.status(200).json({ gistId: '', error: e.message })
  }
}
