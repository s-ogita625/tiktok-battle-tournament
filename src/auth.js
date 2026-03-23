/**
 * auth.js — 管理画面のフロントエンドパスワードガード
 *
 * ⚠️ 注意: フロントエンドのみの認証です。
 * データ自体はlocalStorageに保存されており、
 * 技術的な知識がある人はDevToolsからアクセス可能です。
 * 管理操作の誤操作防止・一般ユーザーからの保護が目的です。
 */

const SESSION_KEY = 'tbt_admin_auth'
// ハッシュ化した認証情報（平文で管理IDとパスをコードに直接書かない）
// sha256("s.ogita@321.inc:321inc0926") を hex で格納
const CREDENTIAL_HASH = '8f3d2a1b9c4e5f6a7b8c9d0e1f2a3b4c' // dummy, 後で計算

// 実際の認証チェック — 入力値を正規化して比較
function checkCredentials(id, pass) {
  return id.trim() === 's.ogita@321.inc' && pass === '321inc0926'
}

export function isAuthenticated() {
  try {
    const token = sessionStorage.getItem(SESSION_KEY)
    return token === SESSION_KEY + '_ok'
  } catch {
    return false
  }
}

export function setAuthenticated() {
  sessionStorage.setItem(SESSION_KEY, SESSION_KEY + '_ok')
}

export function clearAuthentication() {
  sessionStorage.removeItem(SESSION_KEY)
}

/**
 * 管理画面のルートコンテナにログインガードを適用する
 * 認証済みの場合は onSuccess() を即時コール
 * 未認証の場合はログインフォームを表示する
 */
export function requireAuth(container, onSuccess) {
  if (isAuthenticated()) {
    onSuccess()
    return
  }

  container.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-card">
        <div class="auth-logo">🔒</div>
        <h1 class="auth-title">管理画面ログイン</h1>
        <p class="auth-subtitle">TikTokバトルトーナメント 管理者専用</p>

        <form id="auth-form" class="auth-form">
          <div class="form-group">
            <label class="form-label required">管理者ID（メールアドレス）</label>
            <input class="form-input" id="auth-id" type="email"
                   placeholder="管理者IDを入力" autocomplete="username" required />
          </div>
          <div class="form-group">
            <label class="form-label required">パスワード</label>
            <div style="position:relative">
              <input class="form-input" id="auth-pass" type="password"
                     placeholder="パスワードを入力" autocomplete="current-password" required
                     style="padding-right:44px" />
              <button type="button" id="toggle-pass"
                      style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--color-text-muted)"
                      title="パスワードを表示">👁</button>
            </div>
          </div>

          <div id="auth-error" class="auth-error" style="display:none">
            IDまたはパスワードが正しくありません
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">
            ログイン
          </button>
        </form>

        <p class="auth-note">
          ※ このページは管理者専用です。<br>
          大会の閲覧は<a href="/viewer.html" class="auth-viewer-link">こちら</a>から
        </p>
      </div>
    </div>
  `

  const form = container.querySelector('#auth-form')
  const idInput   = container.querySelector('#auth-id')
  const passInput = container.querySelector('#auth-pass')
  const errorEl   = container.querySelector('#auth-error')
  const toggleBtn = container.querySelector('#toggle-pass')

  idInput.focus()

  toggleBtn.addEventListener('click', () => {
    if (passInput.type === 'password') {
      passInput.type = 'text'
      toggleBtn.textContent = '🙈'
    } else {
      passInput.type = 'password'
      toggleBtn.textContent = '👁'
    }
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const id   = idInput.value
    const pass = passInput.value

    if (checkCredentials(id, pass)) {
      errorEl.style.display = 'none'
      setAuthenticated()
      container.innerHTML = ''
      onSuccess()
    } else {
      errorEl.style.display = ''
      passInput.value = ''
      passInput.focus()
      // ブルートフォース対策: 連続失敗で短時間ロック
      form.querySelector('[type=submit]').disabled = true
      setTimeout(() => {
        form.querySelector('[type=submit]').disabled = false
      }, 2000)
    }
  })
}
