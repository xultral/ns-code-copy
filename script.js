// ==UserScript==
// @name         NodeSeek 代码块一键复制
// @namespace    nodeseek-copy
// @version      1.0.0
// @description  自动为 www.nodeseek.com 的代码框添加复制按钮
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

  const STYLE = `
    .ns-codewrap {
      position: relative !important;
    }
    .ns-copy-btn {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 9999;
      border: 1px solid rgba(255,255,255,0.22);
      background: rgba(0,0,0,0.55);
      color: #fff;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition: transform .12s ease, background .12s ease, opacity .12s ease;
      opacity: .9;
    }
    .ns-copy-btn:hover { transform: scale(1.03); background: rgba(0,0,0,0.7); opacity: 1; }
    .ns-copy-btn:active { transform: scale(0.98); }
    .ns-copy-btn.ns-ok { background: rgba(34,197,94,0.85); border-color: rgba(34,197,94,0.35); }
    .ns-copy-btn.ns-err { background: rgba(239,68,68,0.85); border-color: rgba(239,68,68,0.35); }
    .ns-toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 999999;
      background: rgba(0,0,0,0.82);
      color: #fff;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 13px;
      max-width: min(520px, calc(100vw - 36px));
      word-break: break-word;
      box-shadow: 0 10px 30px rgba(0,0,0,.25);
      display: none;
    }
  `;

  GM_addStyle(STYLE);

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

  function getCodeText(el) {
    // 1) <pre><code>...</code></pre>
    // 2) <pre>...</pre>
    // 3) 某些地方可能直接是 <code>...</code>
    if (!el) return '';
    // 取 textContent 最稳（保留换行、忽略高亮标签）
    return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  async function copyText(text) {
    if (!text) throw new Error('EMPTY');

    // 优先 GM_setClipboard
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text/plain');
        return;
      }
    } catch (_) {}

    // 回退 navigator.clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch (_) {}

    // 最后回退 execCommand
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

  function ensureWrapped(block) {
    // 为了让按钮定位，给外层加 relative
    // 如果 block 是 <code>，优先包裹它的 <pre>，否则包裹自己
    const pre = block.tagName === 'CODE' ? block.closest('pre') : null;
    const host = pre || block;

    if (!host) return null;
    if (!host.classList.contains('ns-codewrap')) host.classList.add('ns-codewrap');
    return { host, codeEl: (pre ? (pre.querySelector('code') || pre) : block) };
  }

  function addButtonTo(block) {
    const wrapped = ensureWrapped(block);
    if (!wrapped) return;

    const { host, codeEl } = wrapped;

    // 防重复
    if (host.querySelector(':scope > .ns-copy-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ns-copy-btn';
    btn.textContent = '复制';
    btn.title = '复制代码';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const text = getCodeText(codeEl);
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

    host.appendChild(btn);
  }

  function scanAndAttach(root = document) {
    // 目标选择器尽量宽松：pre、pre code、以及一些可能的 code 容器
    const candidates = new Set();

    root.querySelectorAll('pre').forEach((pre) => candidates.add(pre));
    root.querySelectorAll('pre code').forEach((code) => candidates.add(code));
    // 兜底：有些页面可能直接用 code 作为块级容器（不一定准确，但一般不会太多）
    root.querySelectorAll('code').forEach((code) => {
      // 过滤一下很短的内联 code（比如一两个词），避免到处都是按钮
      const txt = (code.textContent || '').trim();
      if (txt.length >= 40 || txt.includes('\n')) candidates.add(code);
    });

    candidates.forEach((el) => addButtonTo(el));
  }

  // 初次扫描
  scanAndAttach();

  // 监听动态内容变化（帖子切换、翻页、SPA 更新）
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // 只对新增节点做扫描，避免全量扫太频繁
        scanAndAttach(node);
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

})();
