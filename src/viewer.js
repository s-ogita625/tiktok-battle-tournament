/**
 * viewer.js — 閲覧専用ページのエントリーポイント
 * /tournament-data.json を fetch して表示する（localStorage 不使用）
 */
import { renderViewerApp } from './components/ViewerApp.js'

const appEl = document.getElementById('viewer-app')
if (appEl) {
  renderViewerApp(appEl)
}
