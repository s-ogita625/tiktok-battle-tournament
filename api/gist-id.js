/**
 * api/gist-id.js — Gist ID を返すエンドポイント
 * 閲覧ページ（スマホ等）が Gist ID を知るために使用する。
 * 環境変数 GIST_ID が設定されていればそれを返す。
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const gistId = process.env.GIST_ID || ''
  res.status(200).json({ gistId })
}
