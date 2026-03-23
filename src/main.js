import { store } from './data/store.js'
import { requireAuth, clearAuthentication } from './auth.js'
import { renderHomeScreen } from './components/HomeScreen.js'
import { renderNavigation } from './components/Navigation.js'
import { renderParticipantForm } from './components/ParticipantForm.js'
import { renderParticipantList } from './components/ParticipantList.js'
import { renderGroupStage } from './components/GroupStage.js'
import { renderTournamentBracket } from './components/TournamentBracket.js'
import { renderNoticeBoard } from './components/NoticeBoard.js'
import { renderSettings } from './components/Settings.js'
import { assignGroups } from './services/groupService.js'

const appRoot = document.getElementById('app')

// =============================================
//  認証ガード: 未ログインの場合はログイン画面を表示
// =============================================
requireAuth(appRoot, initApp)

function initApp() {
  // ログイン後に #app の中身がクリアされているので
  // admin.html の構造を復元してから取得する
  if (!document.getElementById('home-container')) {
    appRoot.innerHTML = `
      <div id="home-container"></div>
      <header class="app-header" id="nav-container" style="display:none"></header>
      <main id="main-content" class="main-content" style="display:none"></main>
    `
  }

  const navContainer  = document.getElementById('nav-container')
  const mainContent   = document.getElementById('main-content')
  const homeContainer = document.getElementById('home-container')

  // ナビバーにログアウト + 閲覧ページリンクを追加
  addHeaderActions()

  // =============================================
  //  ホーム画面
  // =============================================
  renderHomeScreen(homeContainer, () => {
    switchToEdit()
  })

  // =============================================
  //  ナビゲーション
  // =============================================
  renderNavigation(
    navContainer,
    (tabId) => { renderPage(tabId) },
    () => { switchToHome() }
  )

  // =============================================
  //  初期表示
  // =============================================
  const initialAppStage = store.getState().appStage
  if (initialAppStage === 'edit' && store.getState().currentTournament) {
    switchToEdit()
  } else {
    switchToHome()
  }

  // =============================================
  //  ストア変更を監視
  // =============================================
  store.subscribe((state) => {
    if (state.appStage === 'home') {
      homeContainer.style.display = ''
      navContainer.style.display  = 'none'
      mainContent.style.display   = 'none'
    } else if (state.appStage === 'edit') {
      homeContainer.style.display = 'none'
      navContainer.style.display  = ''
      mainContent.style.display   = ''
    }
  })

  // =============================================
  //  内部関数: 画面切り替え・ページ描画
  // =============================================
  function switchToHome() {
    store.update({ appStage: 'home' })
    homeContainer.style.display = ''
    navContainer.style.display  = 'none'
    mainContent.style.display   = 'none'
    mainContent.innerHTML       = ''
  }

  function switchToEdit() {
    store.update({ appStage: 'edit' })
    homeContainer.style.display = 'none'
    navContainer.style.display  = ''
    mainContent.style.display   = ''
    const stage = store.getState().currentTournament?.stage || 'participants'
    renderPage(stage)
  }

  function renderPage(stage) {
    mainContent.innerHTML = ''

    if (stage === 'settings') {
      renderSettings(mainContent)
    } else if (stage === 'participants') {
      renderParticipantsPage()
    } else if (stage === 'groups') {
      renderGroupStage(mainContent)
    } else if (stage === 'tournament') {
      renderTournamentBracket(mainContent)
    } else if (stage === 'notice') {
      renderNoticeBoard(mainContent)
    }
  }

  function renderParticipantsPage() {
    mainContent.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">参加者管理</h1>
          <p class="page-subtitle">バトルに参加する選手を登録してください</p>
        </div>
      </div>
      <div class="participants-layout">
        <div id="form-area"></div>
        <div id="list-area"></div>
      </div>
    `

    const formArea = mainContent.querySelector('#form-area')
    const listArea = mainContent.querySelector('#list-area')

    renderParticipantForm(formArea, null)
    renderParticipantList(listArea, formArea)

    listArea.addEventListener('assign-groups', () => {
      const ct = store.getState().currentTournament
      if (!ct || ct.participants.length < 2) return

      const groups = assignGroups(ct.participants, ct.settings)
      store.updateTournament({ groups, stage: 'groups' })
      renderPage('groups')
      showToast(`${groups.length}グループに割り振りました！`, 'success')
    })
  }
}

// =============================================
//  ヘッダーアクション（ログアウト・閲覧ページ）
// =============================================
function addHeaderActions() {
  let bar = document.getElementById('admin-action-bar')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'admin-action-bar'
    bar.className = 'admin-action-bar'
    bar.innerHTML = `
      <a href="/viewer.html" target="_blank" rel="noopener" class="btn btn-secondary btn-xs">
        👁 閲覧ページを開く
      </a>
      <button id="logout-btn" class="btn btn-danger btn-xs">ログアウト</button>
    `
    document.body.appendChild(bar)
  }
  document.querySelector('#logout-btn')?.addEventListener('click', () => {
    if (confirm('ログアウトしますか？')) {
      clearAuthentication()
      location.reload()
    }
  })
}

// =============================================
//  ユーティリティ
// =============================================
function showToast(message, type = 'info') {
  let toastContainer = document.querySelector('.toast-container')
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  toastContainer.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}
