const STORAGE_KEY = 'tbt_state'

const defaultTournament = {
  id: null,
  title: '',
  createdAt: null,
  isPublic: false, // 閲覧ページへの公開フラグ（デフォルト非公開）
  settings: {
    tournamentSize: 8,
    defaultBattleTimes: ['19:00', '20:00', '21:00']
  },
  participants: [],
  groups: [],
  tournamentBracket: null,
  stage: 'participants' // participants | groups | tournament | finished
}

const defaultState = {
  // 現在編集中の大会（nullなら大会一覧画面を表示）
  currentTournament: null,
  // 完了・保存済みの大会アーカイブ
  tournaments: [],
  // アプリ全体のページ
  appStage: 'home', // home | edit
  version: '1.0.0'
}

let state = loadState()
const listeners = new Set()
let saveTimer = null

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      // v1からのマイグレーション: 旧フォーマットのデータを新フォーマットへ変換
      if (parsed.participants !== undefined && !parsed.tournaments) {
        const migratedTournament = {
          ...defaultTournament,
          id: 'migrated-' + Date.now(),
          title: '第1回大会',
          createdAt: new Date().toISOString(),
          settings: { ...defaultTournament.settings, ...(parsed.settings || {}) },
          participants: parsed.participants || [],
          groups: parsed.groups || [],
          tournamentBracket: parsed.tournamentBracket || null,
          stage: parsed.stage || 'participants'
        }
        return {
          ...defaultState,
          currentTournament: migratedTournament,
          appStage: 'edit'
        }
      }
      return {
        ...defaultState,
        ...parsed,
        currentTournament: parsed.currentTournament
          ? { ...defaultTournament, ...parsed.currentTournament, settings: { ...defaultTournament.settings, ...(parsed.currentTournament.settings || {}) } }
          : null,
        tournaments: parsed.tournaments || []
      }
    }
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
    }
  }, 300)
}

function notify() {
  listeners.forEach(fn => fn(state))
}

export const store = {
  getState() {
    return state
  },

  // アプリ全体の状態更新
  update(updater) {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) }
    } else {
      state = { ...state, ...updater }
    }
    saveState()
    notify()
  },

  // 現在の大会データのみ更新
  updateTournament(updater) {
    if (!state.currentTournament) return
    const updated = typeof updater === 'function'
      ? updater(state.currentTournament)
      : updater
    state = {
      ...state,
      currentTournament: { ...state.currentTournament, ...updated }
    }
    saveState()
    notify()
  },

  // 現在の大会を完了してアーカイブに保存
  archiveCurrentTournament() {
    if (!state.currentTournament) return
    const archived = { ...state.currentTournament, stage: 'finished' }
    state = {
      ...state,
      tournaments: [...state.tournaments, archived],
      currentTournament: null,
      appStage: 'home'
    }
    saveState()
    notify()
  },

  // アーカイブ済み大会を閲覧モードで開く
  openArchivedTournament(id) {
    const t = state.tournaments.find(t => t.id === id)
    if (!t) return
    state = {
      ...state,
      currentTournament: { ...t },
      appStage: 'edit'
    }
    saveState()
    notify()
  },

  // アーカイブ済み大会を削除
  deleteArchivedTournament(id) {
    state = {
      ...state,
      tournaments: state.tournaments.filter(t => t.id !== id)
    }
    saveState()
    notify()
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

  importState(imported) {
    state = {
      ...defaultState,
      ...imported,
      currentTournament: imported.currentTournament
        ? { ...defaultTournament, ...imported.currentTournament, settings: { ...defaultTournament.settings, ...(imported.currentTournament?.settings || {}) } }
        : null,
      tournaments: imported.tournaments || []
    }
    saveState()
    notify()
  }
}

export { defaultTournament }
