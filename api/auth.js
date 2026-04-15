/**
 * api/auth.js — 管理者ログイン検証エンドポイント
 *
 * POST /api/auth に { id, pass } を送信すると、
 * Vercel 環境変数で設定された ADMIN_ID / ADMIN_PASSWORD と照合し、
 * 一致した場合に ADMIN_SECRET を返す。
 *
 * フロントエンド (src/auth.js) はこの secret を sessionStorage に保存し、
 * 以降の /api/publish・/api/upload-image リクエスト時に
 * X-Admin-Secret ヘッダーとして送信することでAPIアクセスを認可する。
 *
 * Vercel 環境変数 (Settings > Environment Variables) に設定:
 *   ADMIN_ID=管理者メールアドレス
 *   ADMIN_PASSWORD=管理者パスワード
 *   ADMIN_SECRET=ランダムな長い文字列（32文字以上推奨）
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method Not Allowed' })

  let id = '', pass = ''
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    id   = body.id   || ''
    pass = body.pass || ''
  } catch {
    return res.status(400).json({ ok: false, message: 'リクエストボディの解析に失敗しました' })
  }

  const adminId   = process.env.ADMIN_ID       || ''
  const adminPass = process.env.ADMIN_PASSWORD  || ''
  const secret    = process.env.ADMIN_SECRET    || ''

  if (!adminId || !adminPass) {
    // 環境変数未設定: フロントがフォールバック認証を使えるよう 503 を返す
    return res.status(503).json({ ok: false, message: '環境変数 ADMIN_ID / ADMIN_PASSWORD が未設定です' })
  }

  if (id.trim() === adminId && pass === adminPass) {
    return res.status(200).json({ ok: true, secret })
  }

  return res.status(401).json({ ok: false, message: 'IDまたはパスワードが正しくありません' })
}
