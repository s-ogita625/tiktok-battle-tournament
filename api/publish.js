/**
 * api/publish.js — Vercel サーバーレス関数
 *
 * 管理画面から POST /api/publish を受け取り、
 * 環境変数に設定した GitHub Token を使って
 * public/tournament-data.json を GitHub 上で更新する。
 *
 * ブラウザ側に GitHub Token を持たせる必要がないため、
 * スマホ等どのデバイスからでもトークンなしで閲覧できる。
 *
 * Vercel 環境変数 (Settings > Environment Variables) に設定:
 *   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
 */

const GITHUB_OWNER  = 's-ogita625'
const GITHUB_REPO   = 'tiktok-battle-tournament'
const GITHUB_FILE   = 'public/tournament-data.json'
const GITHUB_BRANCH = 'main'

export default async function handler(req, res) {
  // CORS ヘッダー（プリフライト含む）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
  }

  // サーバー側の環境変数から Token を取得
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return res.status(500).json({
      ok: false,
      message: 'サーバーに GITHUB_TOKEN 環境変数が設定されていません。Vercel の Environment Variables を確認してください。'
    })
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
        profileImageUrl: p.profileImageUrl || '',
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

  const content = Buffer.from(JSON.stringify(publicData, null, 2), 'utf8').toString('base64')

  // 現在のファイルの SHA を取得（PUT に必要）
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
    return res.status(500).json({ ok: false, message: `GitHub API 接続エラー: ${e.message}` })
  }

  // ファイルを更新（PUT）
  try {
    const putBody = {
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
          Accept:         'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putBody)
      }
    )

    if (putRes.ok) {
      return res.status(200).json({
        ok: true,
        message: `✅ ${tournaments.length}件の大会を公開しました！\nVercel が自動デプロイを開始します（約1〜2分で反映）`
      })
    }

    const errJson = await putRes.json().catch(() => ({}))
    if (putRes.status === 401) return res.status(401).json({ ok: false, message: 'Token 認証エラー: GITHUB_TOKEN を確認してください' })
    if (putRes.status === 403) return res.status(403).json({ ok: false, message: '権限エラー: GITHUB_TOKEN に repo の Write 権限があるか確認してください' })
    return res.status(putRes.status).json({ ok: false, message: `GitHub API エラー (${putRes.status}): ${errJson.message || '不明なエラー'}` })

  } catch (e) {
    return res.status(500).json({ ok: false, message: `通信エラー: ${e.message}` })
  }
}
