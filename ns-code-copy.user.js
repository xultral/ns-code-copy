// ==UserScript==
// @name         NodeSeek 代码块一键复制（排除编辑器）
// @namespace    nodeseek-copy
// @version      1.1.0
// @description  自动为 www.nodeseek.com 的帖子/预览代码块添加复制按钮，排除 CodeMirror 编辑器每行
// @author       you
// @license      MIT
// @match        https://www.nodeseek.com/*
// @match        http://www.nodeseek.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    .ns-codewrap { position: relative !important; }
    .ns-copy-btn{
      position:absolute; top:10px; right:10px; z-index:9999;
      border:1px solid rgba(255,255,255,.22);
      background:rgba(0,0,0,.55); color:#fff;
      padding:6px 10px; border-radius:8px;
      font-size:12px; line-height:1; cursor:pointer;
      user-select:none; transition:transform .12s ease, background .12s ease, opacity .12s ease;
      opacity:.9;
    }
    .ns-copy-btn:hover{ transform:scale(1.03); background:rgba(0,0,0,.7); opacity:1; }
    .ns-copy-btn:active{ transform:scale(.98); }
    .ns-copy-btn.ns-ok{ background:rgba(34,197,94,.85); border-color:rgba(34,197,94,.35); }
    .ns-copy-btn.ns-err{ background:rgba(239,68,68,.85); border-color:rgba(239,68,68,.35); }
    .ns-toast{
      position:fixed; right:18px; bottom:18px; z-index:999999;
      background:rgba(0,0,0,.82); color:#fff;
      padding:10px 12px; border-radius:10px; font-size:13px;
      max-width:min(520px, calc(100vw - 36px));
      word-break:break-word; box-shadow:0 10px 30px rgba(0,0,0,.25);
      display:none;
    }
  `);

  // 关键：编辑器/CodeMirror 区域排除（避免“一行一个按钮”）
  const EXCLUDE_SELECTOR = [
    '.md-editor',
    '#code-mirror-editor',
    '#cm-editor-wrapper',
    '.CodeMirror',
    '.CodeMirror-code',
    '.CodeMirror-line',
    '.CodeMirror-lines'
  ].join(',');

  function showToast(msg, ms = 2200) {
    let t = document.querySelector('.ns-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ns-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => (t.style.display = 'none'), ms);
  }

  function getText(el) {
    return (el?.textContent || '').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  async function copyText(text) {
    if (!text) throw new Error('EMPTY');
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text/plain');
        return;
      }
    } catch (_) {}

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (_) {}

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('COPY_FAILED');
  }

  function inExcludedArea(el) {
    return !!el.closest(EXCLUDE_SELECTOR);
  }

  function addBtnToPre(pre) {
    if (!pre || inExcludedArea(pre)) return;

    // 只给“块级 pre”加：跳过 CodeMirror 的 pre.CodeMirror-line 之类
    if (pre.classList.contains('CodeMirror-line') || pre.closest('.CodeMirror')) return;

    // 防重复
    if (pre.querySelector(':scope > .ns-copy-btn')) return;

    // wrap
    pre.classList.add('ns-codewrap');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ns-copy-btn';
    btn.textContent = '复制';
    btn.title = '复制代码';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const codeEl = pre.querySelector('code') || pre;
      const text = getText(codeEl);

      try {
        await copyText(text);
        btn.classList.remove('ns-err');
        btn.classList.add('ns-ok');
        btn.textContent = '已复制';
        showToast('✅ 已复制代码');
        setTimeout(() => {
          btn.classList.remove('ns-ok');
          btn.textContent = '复制';
        }, 1400);
      } catch (err) {
        btn.classList.remove('ns-ok');
        btn.classList.add('ns-err');
        btn.textContent = '失败';
        showToast('❌ 复制失败（可能没有权限）');
        setTimeout(() => {
          btn.classList.remove('ns-err');
          btn.textContent = '复制';
        }, 1600);
      }
    });

    pre.appendChild(btn);
  }

  function scan(root = document) {
    // 最稳：只扫 pre（渲染出来的代码块一般是 pre 或 pre>code）
    root.querySelectorAll('pre').forEach(addBtnToPre);
  }

  // 首次扫描：页面加载完
  scan();

  // 动态更新：仅扫描新增节点
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // 新节点本身就是 pre
        if (node.matches?.('pre')) addBtnToPre(node);
        // 或包含 pre
        scan(node);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

})();
