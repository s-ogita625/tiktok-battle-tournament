import { store } from '../data/store.js'

const TABS = [
  { id: 'participants', label: '👥 参加者' },
  { id: 'groups',       label: '⚔️ グループ戦' },
  { id: 'tournament',   label: '🏆 トーナメント' },
  { id: 'notice',       label: '📢 連絡' },
  { id: 'settings',     label: '⚙️ 設定' }
]

export function renderNavigation(container, onTabChange, onGoHome) {
  function render() {
    const { appStage, currentTournament } = store.getState()

    if (appStage !== 'edit' || !currentTournament) {
      container.innerHTML = ''
      return
    }

    const { stage, groups, tournamentBracket, title } = currentTournament

    container.innerHTML = `
      <div class="nav-bar">
        <button class="nav-home-btn" id="nav-home-btn" title="大会一覧へ戻る">
          ← 一覧
        </button>
        <span class="nav-tournament-title">${escHtml(title || '大会')}</span>
        <nav class="nav-tabs">
          ${TABS.map(tab => {
            const isDisabled =
              (tab.id === 'groups'      && (groups || []).length === 0) ||
              (tab.id === 'tournament'  && !tournamentBracket) ||
              (tab.id === 'notice'      && (groups || []).length === 0)
            const isActive = stage === tab.id
            return `
              <button
                class="nav-tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}"
                data-tab="${tab.id}"
                ${isDisabled ? 'disabled' : ''}
              >${tab.label}</button>
            `
          }).join('')}
        </nav>
      </div>
    `

    container.querySelector('#nav-home-btn')?.addEventListener('click', () => {
      onGoHome()
    })

    container.querySelectorAll('[data-tab]:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab
        store.updateTournament({ stage: tabId })
        onTabChange(tabId)
      })
    })
  }

  store.subscribe(render)
  render()
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
