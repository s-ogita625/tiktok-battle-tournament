/**
 * viewer.js — 閲覧専用ページのエントリーポイント
 * localStorage の共有データを読み取り専用で表示する
 */
import { store } from './data/store.js'
import { renderViewerApp } from './components/ViewerApp.js'

const appEl = document.getElementById('viewer-app')
if (appEl) {
  renderViewerApp(appEl)
}
