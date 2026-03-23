import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 3001

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// TikTok oEmbed プロキシエンドポイント
app.get('/api/tiktok/oembed', async (req, res) => {
  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'url パラメータが必要です' })
  }

  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TikTokBattleApp/1.0)'
      }
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: 'TikTok APIエラー' })
    }

    const data = await response.json()
    res.json({
      thumbnailUrl: data.thumbnail_url || null,
      authorName: data.author_name || null,
      title: data.title || null
    })
  } catch (error) {
    console.error('oEmbed取得エラー:', error)
    res.status(500).json({ error: 'プロフィール画像の取得に失敗しました' })
  }
})

// /api/publish — ローカル開発用（Vercel本番は api/publish.js が担当）
// 公開データを public/tournament-data.json に書き込む
app.post('/api/publish', (req, res) => {
  const tournaments = Array.isArray(req.body?.tournaments) ? req.body.tournaments : []

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

  try {
    const filePath = resolve(__dirname, 'public/tournament-data.json')
    writeFileSync(filePath, JSON.stringify(publicData, null, 2), 'utf8')
    res.json({ ok: true, message: `✅ ${tournaments.length}件の大会をローカルに保存しました（リロードすると反映）` })
  } catch (e) {
    res.status(500).json({ ok: false, message: `ファイル書き込みエラー: ${e.message}` })
  }
})

app.listen(PORT, () => {
  console.log(`プロキシサーバー起動中: http://localhost:${PORT}`)
})
