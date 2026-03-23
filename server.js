import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

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

app.listen(PORT, () => {
  console.log(`プロキシサーバー起動中: http://localhost:${PORT}`)
})
