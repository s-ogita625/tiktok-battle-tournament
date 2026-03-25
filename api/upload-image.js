/**
 * api/upload-image.js — 参加者プロフィール画像を GitHub Gist に保存するエンドポイント
 *
 * 管理画面でアップロードされた Base64 画像を、既存の Gist に
 * img-{participantId}.b64 という別ファイルとして追加する。
 *
 * これにより:
 *   - api/publish のリクエストボディには Base64 が含まれない（4.5MB 制限を回避）
 *   - 画像の RAW URL を profileImageUrl として tournament-data.json に保存できる
 *   - 閲覧ページは通常の <img src="..."> で画像を表示できる
 *
 * リクエスト (POST):
 *   { participantId: string, base64: string, gistId: string }
 *   - base64: "data:image/..." プレフィックスを含む完全な data:URL
 *   - gistId: 既存の Gist ID（api/publish.js で作成済みのもの）
 *             空の場合は新規 Gist を作成する
 *
 * レスポンス:
 *   { ok: true, rawUrl: string, gistId: string }
 *   - rawUrl: Gist の RAW URL（img タグの src に直接使用可能）
 */

const GIST_OWNER = 's-ogita625'

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
      message: 'GITHUB_TOKEN 環境変数が設定されていません。'
    })
  }

  let participantId, base64, gistId
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    participantId = body?.participantId || ''
    base64        = body?.base64        || ''
    gistId        = body?.gistId        || ''
  } catch {
    return res.status(400).json({ ok: false, message: 'リクエストボディの解析に失敗しました' })
  }

  if (!participantId) {
    return res.status(400).json({ ok: false, message: 'participantId が必要です' })
  }
  if (!base64) {
    return res.status(400).json({ ok: false, message: 'base64 が必要です' })
  }

  // data:image/jpeg;base64,XXXX... から純粋な Base64 部分を抽出
  // ファイル内容として Gist に保存する（MIME タイプはファイル名で管理）
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64

  if (!base64Data) {
    return res.status(400).json({ ok: false, message: 'Base64 データが空です' })
  }

  const fileKey = `img-${participantId}.b64`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'TikTokBattleTournament'
  }

  try {
    let resultGistId = gistId

    if (gistId) {
      // 既存 Gist に画像ファイルを追加/更新（PATCH）
      const gistRes = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          files: { [fileKey]: { content: base64Data } }
        })
      })

      if (!gistRes.ok) {
        const errJson = await gistRes.json().catch(() => ({}))
        const status = gistRes.status
        if (status === 401) return res.status(401).json({ ok: false, message: 'Token 認証エラー: GITHUB_TOKEN を確認してください' })
        if (status === 403) return res.status(403).json({ ok: false, message: '権限エラー: gist スコープが必要です' })
        if (status === 404) {
          // Gist が見つからない場合は新規作成にフォールバック
          resultGistId = ''
        } else {
          return res.status(status).json({ ok: false, message: `GitHub Gist API エラー (${status}): ${errJson.message || '不明なエラー'}` })
        }
      }
    }

    if (!resultGistId) {
      // 新規 Gist を作成（POST）
      const gistRes = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: 'TikTokBattleTournament-Public',
          public: true,
          files: {
            'tournament-data.json': { content: '{}' },
            [fileKey]: { content: base64Data }
          }
        })
      })

      if (!gistRes.ok) {
        const errJson = await gistRes.json().catch(() => ({}))
        return res.status(gistRes.status).json({ ok: false, message: `Gist 作成エラー: ${errJson.message || '不明なエラー'}` })
      }

      const gistJson = await gistRes.json()
      resultGistId = gistJson.id
    }

    // キャッシュバスター付き RAW URL を返す
    // ※ Gist の RAW URL は更新があると末尾にコミットハッシュが付くが、
    //    ファイル名のみで指定すると常に最新を取得できる
    const rawUrl = `https://gist.githubusercontent.com/${GIST_OWNER}/${resultGistId}/raw/${fileKey}`

    return res.status(200).json({
      ok: true,
      rawUrl,
      gistId: resultGistId
    })

  } catch (e) {
    return res.status(500).json({ ok: false, message: `通信エラー: ${e.message}` })
  }
}
