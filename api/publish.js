/**
 * api/publish.js — Vercel サーバーレス関数
 *
 * 管理画面から POST /api/publish を受け取り、
 * 環境変数に設定した GitHub Token を使って
 * GitHub Gist に大会データを保存する。
 *
 * Gist を使う理由:
 *   - Vercel のデプロイで public/ ファイルが上書きされる問題を回避
 *   - token に必要なスコープが「gist」のみで済む（repo 不要）
 *   - Classic token で簡単に発行できる
 *
 * Vercel 環境変数 (Settings > Environment Variables) に設定:
 *   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx  （gist スコープがあればOK）
 *   GIST_ID=（自動作成されるので初回は不要。初回実行後に自動設定されるが、
 *             手動で設定する場合は Gist の URL 末尾の ID を設定）
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' })

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return res.status(500).json({
      ok: false,
      message: 'GITHUB_TOKEN 環境変数が設定されていません。Vercel の Environment Variables を確認してください。'
    })
  }

  // 管理者トークン認証（ADMIN_SECRET が設定されている場合のみチェック）
  const adminSecret = process.env.ADMIN_SECRET
  if (adminSecret) {
    const reqSecret = req.headers['x-admin-secret'] || ''
    if (reqSecret !== adminSecret) {
      return res.status(403).json({ ok: false, message: '認証エラー: 管理者権限が必要です。再ログインしてください。' })
    }
  }

  // リクエストボディから大会データを受け取る
  let tournaments = []
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    tournaments = Array.isArray(body?.tournaments) ? body.tournaments : []
  } catch {
    return res.status(400).json({ ok: false, message: 'リクエストボディの解析に失敗しました' })
  }

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
      participants: (t.participants || []).map(p => ({
        id:              p.id,
        name:            p.name,
        tiktokUrl:       p.tiktokUrl  || '',
        // publishUtils.js 側で Base64 → Gist RAW URL へ変換済み
        // data: が残っている場合は念のため除外（サイズ制限対策）
        profileImageUrl: (p.profileImageUrl && !p.profileImageUrl.startsWith('data:'))
          ? p.profileImageUrl
          : '',
        groupId:         p.groupId    || null,
        availableDates:              p.availableDates             || [],
        unavailableDates:            p.unavailableDates           || [],
        tournamentAvailableDates:    p.tournamentAvailableDates   || [],
        tournamentUnavailableDates:  p.tournamentUnavailableDates || []
      })),
      groups:            t.groups            || [],
      tournamentBracket: t.tournamentBracket || null
    }))
  }

  const jsonContent = JSON.stringify(publicData, null, 2)
  const gistId = process.env.GIST_ID || ''
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'TikTokBattleTournament'
  }

  try {
    let gistRes
    let effectiveGistId = gistId   // 実際に使用された Gist ID

    if (gistId) {
      // 既存 Gist を更新（PATCH）
      gistRes = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          description: 'TikTokBattleTournament-Public',
          public: true,
          files: { 'tournament-data.json': { content: jsonContent } }
        })
      })

      // 404（Gist が削除済み・環境変数の ID が無効など）ならフォールバックで新規作成
      if (gistRes.status === 404) {
        effectiveGistId = ''
        gistRes = null
      }
    }

    if (!effectiveGistId) {
      // 初回 or 404 フォールバック：新規 Gist を作成（POST）
      gistRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: 'TikTokBattleTournament-Public',
          public: true,
          files: { 'tournament-data.json': { content: jsonContent } }
        })
      })
    }

    if (!gistRes.ok) {
      const errJson = await gistRes.json().catch(() => ({}))
      const status = gistRes.status
      // デバッグ情報（どの分岐のエラーか・元の env var の有無）を含める
      const phase = effectiveGistId ? 'PATCH' : 'POST'
      const hadEnvGistId = !!gistId
      const ghMsg = errJson.message || '不明なエラー'
      if (status === 401) return res.status(401).json({ ok: false, message: `Token 認証エラー (${phase}): GITHUB_TOKEN を確認してください（有効期限切れの可能性があります）。詳細: ${ghMsg}` })
      if (status === 403) return res.status(403).json({ ok: false, message: `権限エラー (${phase}): gist スコープが必要です。Classic token を使用してください。詳細: ${ghMsg}` })
      if (status === 404) return res.status(404).json({ ok: false, message: `Gist 404 (${phase}, envGistId=${hadEnvGistId}): ${ghMsg}。トークンに gist スコープがあるか確認してください。` })
      return res.status(status).json({ ok: false, message: `GitHub Gist API エラー (${phase}, ${status}): ${ghMsg}` })
    }

    const gistJson = await gistRes.json()
    const newGistId = gistJson.id
    // raw URL（キャッシュなし）
    const rawUrl = `https://gist.githubusercontent.com/s-ogita625/${newGistId}/raw/tournament-data.json`

    return res.status(200).json({
      ok: true,
      gistId: newGistId,
      rawUrl,
      message: `✅ ${tournaments.length}件の大会を公開しました！\n閲覧ページに即座に反映されます。\nGist ID: ${newGistId}`
    })

  } catch (e) {
    return res.status(500).json({ ok: false, message: `通信エラー: ${e.message}` })
  }
}
