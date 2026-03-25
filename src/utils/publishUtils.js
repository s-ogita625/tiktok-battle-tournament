/**
 * publishUtils.js
 * 公開データを Vercel サーバーレス関数 (/api/publish) 経由で GitHub Gist に保存する。
 *
 * 仕組み:
 *   1. 管理画面が「公開中」の大会を publishTournamentData() で送信
 *   2. Base64 画像（data:image/...）がある参加者は、先に /api/upload-image で
 *      Gist に個別アップロードし、profileImageUrl を Gist RAW URL に変換する
 *      ※ Vercel リクエストボディ上限 (4.5MB) 対策のため画像は個別に送信
 *   3. URL 変換済みの大会データを /api/publish に POST
 *   4. 返ってきた Gist ID を localStorage に保存
 *   5. 閲覧ページ (ViewerApp.js) が Gist の raw URL から直接データを取得
 *      → Vercel の再デプロイは不要、即座に全デバイスに反映
 *
 * 必要な GitHub Token のスコープ: gist のみ（repo 不要）
 * Classic token で発行してください（Fine-grained token は Gist 非対応）
 */

const GIST_ID_STORAGE_KEY = 'tbt_gist_id'

/** 保存済み Gist ID を取得 */
export function getSavedGistId() {
  try { return localStorage.getItem(GIST_ID_STORAGE_KEY) || '' } catch { return '' }
}

/** Gist ID を localStorage に保存 */
export function saveGistId(id) {
  try { localStorage.setItem(GIST_ID_STORAGE_KEY, id) } catch {}
}

/**
 * Base64 画像を /api/upload-image 経由で Gist にアップロードし RAW URL を返す
 * @param {string} participantId  参加者 ID
 * @param {string} base64DataUrl  data:image/jpeg;base64,... 形式の文字列
 * @param {string} gistId         既存の Gist ID（なければ空文字）
 * @returns {Promise<{ok:boolean, rawUrl?:string, gistId?:string}>}
 */
async function uploadImageToGist(participantId, base64DataUrl, gistId) {
  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, base64: base64DataUrl, gistId })
    })
    const data = await res.json().catch(() => ({}))
    return data
  } catch (e) {
    return { ok: false, message: e.message }
  }
}

/**
 * 公開対象の大会データを /api/publish に POST する内部関数
 */
async function postToPublishApi(tournaments) {
  const res = await fetch('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tournaments })
  })
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

/**
 * 公開対象の大会データを Gist に保存する
 *
 * Base64 画像がある参加者は先に /api/upload-image で個別アップロードし、
 * profileImageUrl を Gist RAW URL に変換してから /api/publish に送信する。
 *
 * @param {Array} tournaments  isPublic=true の大会配列（空配列も可）
 * @param {Function} [onProgress]  進捗コールバック (message: string) => void
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function publishTournamentData(tournaments, onProgress) {
  if (!tournaments) tournaments = []

  try {
    let currentGistId = getSavedGistId()

    // -----------------------------------------------------------------
    // ステップ1: Base64 画像がある参加者を先に Gist にアップロード
    // -----------------------------------------------------------------
    // Base64 画像を持つ参加者を収集
    const uploadTasks = []
    tournaments.forEach(t => {
      ;(t.participants || []).forEach(p => {
        if (p.profileImageUrl && p.profileImageUrl.startsWith('data:')) {
          uploadTasks.push({ tournamentId: t.id, participantId: p.id, base64: p.profileImageUrl })
        }
      })
    })

    // 画像アップロード（順次実行: gistId を正しく伝播させるため）
    // ※ 並列実行すると、gistId が空の場合に全タスクが同時に空のgistIdで送られ
    //    複数の別々のGistが作成されてしまうため、順次実行に変更
    const uploadedUrls = {} // key: participantId → rawUrl
    if (uploadTasks.length > 0) {
      onProgress?.(`⏳ 画像をアップロード中... (${uploadTasks.length}件)`)

      for (let i = 0; i < uploadTasks.length; i++) {
        const task = uploadTasks[i]
        onProgress?.(`⏳ 画像をアップロード中... (${i + 1}/${uploadTasks.length}件)`)
        const result = await uploadImageToGist(task.participantId, task.base64, currentGistId)
        if (result.ok && result.rawUrl) {
          uploadedUrls[task.participantId] = result.rawUrl
          // アップロード中に Gist が新規作成された場合、そのIDを以降のアップロードでも使用
          if (!currentGistId && result.gistId) {
            currentGistId = result.gistId
            saveGistId(currentGistId)
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // ステップ2: Base64 を Gist RAW URL に差し替えて大会データを構築
    // -----------------------------------------------------------------
    const convertedTournaments = tournaments.map(t => ({
      ...t,
      participants: (t.participants || []).map(p => {
        if (uploadedUrls[p.id]) {
          // アップロード成功 → Gist RAW URL に置き換え
          return { ...p, profileImageUrl: uploadedUrls[p.id] }
        }
        return p
      })
    }))

    // -----------------------------------------------------------------
    // ステップ3: 大会データを /api/publish に送信
    // -----------------------------------------------------------------
    onProgress?.('⏳ 大会データを公開中...')

    const { res, data } = await postToPublishApi(convertedTournaments)

    if (res.ok && data.ok) {
      if (data.gistId) saveGistId(data.gistId)
      const imgCount = uploadTasks.length
      const imgNote = imgCount > 0 ? `\n画像 ${imgCount}件もアップロードしました。` : ''
      return {
        ok: true,
        message: (data.message || `✅ ${tournaments.length}件の大会を公開しました！`) + imgNote
      }
    }

    return {
      ok: false,
      message: data.message || `サーバーエラー (${res.status})`
    }

  } catch (e) {
    return { ok: false, message: `通信エラー: ${e.message}` }
  }
}
