const STORAGE_KEY = 'tbt_state'

const defaultTournament = {
  id: null,
  title: '',
  createdAt: null,
  isPublic: false, // 閲覧ページへの公開フラグ（デフォルト非公開）
  archived: false, // 終了（過去大会）フラグ。false=進行中 / true=過去
  settings: {
    tournamentSize: 8,
    defaultBattleTimes: ['21:00', '21:30', '22:00', '22:30', '23:00', '23:30']
  },
  participants: [],
  groups: [],
  tournamentBracket: null,
  stage: 'participants' // participants | groups | tournament | finished（画面タブ兼進捗）
}

// 新データモデル:
//   tournaments … 全イベントを1つの配列で保持（各要素に archived フラグ）
//   editingId  … 現在エディタで開いているイベントの id（null なら未選択）
//   currentTournament は「editingId のイベントを返す算出プロパティ」として getState() が付与する
const defaultState = {
  tournaments: [],
  editingId: null,
  appStage: 'home', // home | edit
  version: '1.0.0'
}

let state = loadState()
const listeners = new Set()
let saveTimer = null

/** 大会オブジェクトをデフォルト値でnormalizeする（archivedフラグ・settingsを補完） */
function normTournament(t, archivedDefault = false) {
  const src = t || {}
  return {
    ...defaultTournament,
    ...src,
    settings: { ...defaultTournament.settings, ...(src.settings || {}) },
    archived: typeof src.archived === 'boolean' ? src.archived : archivedDefault
  }
}

/**
 * 任意の保存形式（v0 / v1 / 新形式）を新形式 state に変換する。
 * - v0: { participants, groups, ... }（単一大会・tournaments配列なし）
 * - v1: { currentTournament, tournaments[] }
 * - 新: { tournaments[], editingId }
 */
function migrate(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ...defaultState }

  // 新形式（editingId を持つ）
  if (parsed.editingId !== undefined && Array.isArray(parsed.tournaments)) {
    const list = parsed.tournaments.map(t => normTournament(t, t?.archived ?? false))
    const editingId = list.some(t => t.id === parsed.editingId) ? parsed.editingId : null
    return {
      tournaments: list,
      editingId,
      appStage: parsed.appStage || 'home',
      version: '1.0.0'
    }
  }

  // v0（単一大会・旧の旧フォーマット）
  if (parsed.participants !== undefined && !Array.isArray(parsed.tournaments)) {
    const t = normTournament({
      id: 'migrated-' + Date.now(),
      title: '第1回大会',
      createdAt: new Date().toISOString(),
      settings: parsed.settings,
      participants: parsed.participants || [],
      groups: parsed.groups || [],
      tournamentBracket: parsed.tournamentBracket || null,
      stage: parsed.stage || 'participants'
    }, false)
    return { tournaments: [t], editingId: t.id, appStage: 'edit', version: '1.0.0' }
  }

  // v1（currentTournament + tournaments[]）→ 単一リストへ統合
  const list = []
  const seen = new Set()
  if (parsed.currentTournament) {
    const t = normTournament(parsed.currentTournament, false)
    list.push(t)
    if (t.id) seen.add(t.id)
  }
  for (const t of (parsed.tournaments || [])) {
    if (t && t.id && seen.has(t.id)) continue // id重複を排除（過去に発生した重複対策）
    const nt = normTournament(t, true) // 旧tournaments[]は過去大会扱い
    list.push(nt)
    if (nt.id) seen.add(nt.id)
  }
  return {
    tournaments: list,
    editingId: (parsed.currentTournament && parsed.currentTournament.id) || null,
    appStage: parsed.appStage || 'home',
    version: '1.0.0'
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return migrate(JSON.parse(saved))
  } catch (e) {
    console.error('状態の読み込みエラー:', e)
  }
  return { ...defaultState }
}

function saveState() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('状態の保存エラー:', e)
      // 容量超過などで保存に失敗した場合、サイレントなデータ消失を防ぐため通知する。
      const isQuota = !!e && (
        e.name === 'QuotaExceededError' ||
        e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        /quota|exceeded/i.test(e.message || '')
      )
      try {
        window.dispatchEvent(new CustomEvent('tbt-save-error', {
          detail: { quota: isQuota, message: e.message || String(e) }
        }))
      } catch { /* SSR等でwindowが無い場合は無視 */ }
    }
  }, 300)
}

/** editingId のイベントを付与した状態を返す（currentTournament 算出プロパティ） */
function computed() {
  const currentTournament = state.editingId
    ? (state.tournaments.find(t => t.id === state.editingId) || null)
    : null
  return { ...state, currentTournament }
}

function notify() {
  const snapshot = computed()
  listeners.forEach(fn => fn(snapshot))
}

export const store = {
  getState() {
    return computed()
  },

  // アプリ全体の状態更新（appStage / tournaments などトップレベルキー用）
  update(updater) {
    const patch = typeof updater === 'function' ? updater(computed()) : updater
    // currentTournament は算出プロパティなので直接の書き込みは無視する
    const { currentTournament, ...rest } = patch || {}
    state = { ...state, ...rest }
    saveState()
    notify()
  },

  setAppStage(stage) {
    state = { ...state, appStage: stage }
    saveState()
    notify()
  },

  // 編集対象イベントを開く（データ差し替え破棄なし）
  openTournament(id) {
    if (!state.tournaments.some(t => t.id === id)) return
    state = { ...state, editingId: id, appStage: 'edit' }
    saveState()
    notify()
  },

  // ホームへ戻る（編集対象の選択は解除）
  backToHome() {
    state = { ...state, editingId: null, appStage: 'home' }
    saveState()
    notify()
  },

  // 新規イベントを作成して開く（他イベントは終了させない＝並行進行可）
  createTournament(data) {
    const t = normTournament({ ...data }, false)
    state = { ...state, tournaments: [...state.tournaments, t], editingId: t.id, appStage: 'edit' }
    saveState()
    notify()
    return t
  },

  // 現在編集中（editingId）のイベントのみ更新
  updateTournament(updater) {
    if (!state.editingId) return
    state = {
      ...state,
      tournaments: state.tournaments.map(t => {
        if (t.id !== state.editingId) return t
        const patch = typeof updater === 'function' ? updater(t) : updater
        return { ...t, ...patch }
      })
    }
    saveState()
    notify()
  },

  // 公開/非公開の切り替え（id指定）
  setPublic(id, isPublic) {
    state = {
      ...state,
      tournaments: state.tournaments.map(t => t.id === id ? { ...t, isPublic } : t)
    }
    saveState()
    notify()
  },

  // 終了（過去大会化）/ 進行中に戻す（id指定）
  setArchived(id, archived) {
    let next = {
      ...state,
      tournaments: state.tournaments.map(t => t.id === id ? { ...t, archived } : t)
    }
    // 終了した大会を開いていた場合はエディタを閉じてホームへ
    if (archived && state.editingId === id) {
      next = { ...next, editingId: null, appStage: 'home' }
    }
    state = next
    saveState()
    notify()
  },

  // イベント削除（id指定）
  deleteTournament(id) {
    state = {
      ...state,
      tournaments: state.tournaments.filter(t => t.id !== id),
      editingId: state.editingId === id ? null : state.editingId
    }
    saveState()
    notify()
  },

  // ───── 後方互換エイリアス（旧メソッド名の呼び出しを吸収） ─────
  archiveCurrentTournament() {
    if (state.editingId) this.setArchived(state.editingId, true)
  },
  openArchivedTournament(id) {
    this.openTournament(id)
  },
  deleteArchivedTournament(id) {
    this.deleteTournament(id)
  },

  subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  reset() {
    state = { ...defaultState }
    localStorage.removeItem(STORAGE_KEY)
    notify()
  },

  // 任意形式（旧/新）をインポートして置き換え
  importState(imported) {
    state = migrate(imported)
    saveState()
    notify()
  }
}

export { defaultTournament }
