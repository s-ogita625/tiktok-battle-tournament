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

import { getAdminSecret } from '../auth.js'

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
    const secret = getAdminSecret()
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Admin-Secret': secret } : {})
      },
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
  const secret = getAdminSecret()
  const res = await fetch('/api/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'X-Admin-Secret': secret } : {})
    },
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
const GIST_OWNER = 's-ogita625'

/** 公開先の Gist ID を解決（サーバーの env GIST_ID を優先） */
async function resolvePublishGistId() {
  try {
    const res = await fetch(`/api/gist-id?t=${Date.now()}`)
    if (res.ok) {
      const d = await res.json()
      if (d.gistId) return d.gistId
    }
  } catch { /* 無視 */ }
  return getSavedGistId()
}

/**
 * 現在“公開されている”大会一覧を取得する。
 * @returns {Promise<{ok:boolean, tournaments:Array}>}
 *   ok:false は「取得に失敗（他イベントを消さないため中断すべき）」を意味する。
 *   Gist未作成(404)は ok:true, tournaments:[] を返す。
 */
async function fetchPublishedTournaments(gistId) {
  if (!gistId) return { ok: true, tournaments: [] } // まだ公開先が無い＝空
  try {
    const url = `https://gist.githubusercontent.com/${GIST_OWNER}/${gistId}/raw/tournament-data.json?t=${Date.now()}`
    const res = await fetch(url)
    if (res.status === 404) return { ok: true, tournaments: [] }
    if (!res.ok) return { ok: false, tournaments: [] }
    const data = await res.json().catch(() => null)
    if (!data) return { ok: false, tournaments: [] }
    return { ok: true, tournaments: Array.isArray(data.tournaments) ? data.tournaments : [] }
  } catch {
    return { ok: false, tournaments: [] }
  }
}

/**
 * 大会配列内の Base64(data:)画像を Gist にアップロードし RAW URL へ変換する。
 * @returns {Promise<{convertedTournaments:Array, imgCount:number}>}
 */
async function convertImages(tournaments, onProgress) {
  let currentGistId = getSavedGistId()
  const uploadTasks = []
  tournaments.forEach(t => {
    ;(t.participants || []).forEach(p => {
      if (p.profileImageUrl && p.profileImageUrl.startsWith('data:')) {
        uploadTasks.push({ participantId: p.id, base64: p.profileImageUrl })
      }
    })
  })

  const uploadedUrls = {}
  if (uploadTasks.length > 0) {
    onProgress?.(`⏳ 画像をアップロード中... (${uploadTasks.length}件)`)
    for (let i = 0; i < uploadTasks.length; i++) {
      const task = uploadTasks[i]
      onProgress?.(`⏳ 画像をアップロード中... (${i + 1}/${uploadTasks.length}件)`)
      const result = await uploadImageToGist(task.participantId, task.base64, currentGistId)
      if (result.ok && result.rawUrl) {
        uploadedUrls[task.participantId] = result.rawUrl
        if (!currentGistId && result.gistId) {
          currentGistId = result.gistId
          saveGistId(currentGistId)
        }
      }
    }
  }

  const convertedTournaments = tournaments.map(t => ({
    ...t,
    participants: (t.participants || []).map(p =>
      uploadedUrls[p.id] ? { ...p, profileImageUrl: uploadedUrls[p.id] } : p
    )
  }))
  return { convertedTournaments, imgCount: uploadTasks.length }
}

/**
 * 大会データを閲覧ページ（Gist）へ反映する。
 *
 * ★マージ方式★
 *   既に公開されている大会データを取得し、`tournamentsToUpsert` の大会だけを
 *   id 一致で差し替え（追加）、`options.removeIds` の大会を削除して書き戻す。
 *   → 指定した大会以外の公開データはそのまま保持される（他大会を巻き戻さない）。
 *
 * @param {Array} tournamentsToUpsert  反映（追加/更新）したい大会。空配列も可
 * @param {Function} [onProgress]  進捗コールバック
 * @param {object} [options]
 * @param {string[]} [options.removeIds]  公開から外す大会id
 * @param {string}   [options.message]    成功時メッセージ
 * @returns {Promise<{ok:boolean, message:string}>}
 */
export async function publishTournamentData(tournamentsToUpsert, onProgress, options = {}) {
  const upserts = tournamentsToUpsert || []
  const removeIds = options.removeIds || []

  try {
    // 1) 既存の公開データを取得（他大会を保持するため）
    onProgress?.('⏳ 現在の公開データを確認中...')
    const publishGistId = await resolvePublishGistId()
    const existing = await fetchPublishedTournaments(publishGistId)
    if (!existing.ok) {
      return {
        ok: false,
        message: '現在の公開データを取得できませんでした。通信環境を確認して再試行してください。（他の大会を消さないため中断しました）'
      }
    }

    // 2) upsert対象の画像を変換
    const { convertedTournaments, imgCount } = await convertImages(upserts, onProgress)

    // 3) マージ（id一致で差し替え／removeIdsを削除）
    const byId = new Map(existing.tournaments.map(t => [t.id, t]))
    for (const t of convertedTournaments) byId.set(t.id, { ...t, isPublic: true })
    for (const id of removeIds) byId.delete(id)
    const merged = [...byId.values()]

    // 4) 反映
    onProgress?.('⏳ 反映中...')
    const { res, data } = await postToPublishApi(merged)

    if (res.ok && data.ok) {
      if (data.gistId) saveGistId(data.gistId)
      const imgNote = imgCount > 0 ? `\n画像 ${imgCount}件をアップロードしました。` : ''
      return {
        ok: true,
        message: (options.message || `✅ 反映しました（公開中 ${merged.length}件）`) + imgNote
      }
    }
    return { ok: false, message: data.message || `サーバーエラー (${res.status})` }

  } catch (e) {
    return { ok: false, message: `通信エラー: ${e.message}` }
  }
}
