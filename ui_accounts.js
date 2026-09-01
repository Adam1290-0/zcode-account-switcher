// ZCode account switcher — renderer-injected UI (runs in the ZCode window).
// The avatar dropdown (Radix DropdownMenu) is forceMounted: its content lives
// in the DOM permanently and is only shown/hidden. So instead of waiting for
// the menu to appear, we scan the live DOM and anchor to the logout/login
// menu item ("断开连接" / "Disconnect" / "连接使用" / "Connect"), then keep
// re-asserting our injected item in case React reconciles it away.
// NOTE: no window.alert / window.confirm — everything is rendered in-panel.
(function () {
  'use strict';
  if (window.__zcodeAccountSwitcherLoaded) return;
  window.__zcodeAccountSwitcherLoaded = true;

  var API = 'http://127.0.0.1:27890';
  var SCAN_MS = 1500;

  // ------------------------------------------------------------------ styles
  function injectStyle() {
    if (document.getElementById('zcode-acct-style')) return;
    var css = [
      '#zcode-acct-backdrop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;animation:zca-fade .12s ease}',
      '#zcode-acct-card{width:380px;max-width:calc(100vw - 40px);max-height:72vh;display:flex;flex-direction:column;border-radius:14px;background:#17191a;border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 60px rgba(0,0,0,.55);color:#e6e6e6;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}',
      '#zcode-acct-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}',
      '#zcode-acct-head b{font-size:14px}',
      '#zcode-acct-close{cursor:pointer;color:#9a9a9a;font-size:18px;line-height:1;padding:4px;border:none;background:transparent}',
      '#zcode-acct-close:hover{color:#fff}',
      '#zcode-acct-msg{display:none;padding:9px 16px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.08)}',
      '#zcode-acct-msg.err{display:block;color:#f87171;background:rgba(248,113,113,.08)}',
      '#zcode-acct-msg.info{display:block;color:#93c5fd;background:rgba(96,165,250,.08)}',
      '#zcode-acct-current{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}',
      '#zcode-acct-current .badge{font-size:11px;color:#6ee7b7;border:1px solid rgba(110,231,183,.4);padding:1px 6px;border-radius:6px;white-space:nowrap}',
      '#zcode-acct-current .who{min-width:0;flex:1}',
      '#zcode-acct-current .who .n{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#zcode-acct-current .who .e{font-size:11px;color:#8a8f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#zcode-acct-list{flex:1;overflow-y:auto;padding:6px}',
      '.zca-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;cursor:pointer}',
      '.zca-row:hover{background:rgba(255,255,255,.06)}',
      '.zca-row.sel{background:rgba(96,165,250,.14)}',
      '.zca-row .ava{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;flex:0 0 auto}',
      '.zca-row .who{min-width:0;flex:1}',
      '.zca-row .who .n{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px}',
      '.zca-row .who .e{font-size:11px;color:#8a8f96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.zca-row .who .r{font-size:11px;color:#c9a86a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.zca-row .who .r.empty{color:#5f6570}',
      '.zca-row .rinput{font-size:11px;width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#e6e6e6;padding:1px 4px;outline:none}',
      '.zca-pbadge{font-size:9px;padding:1px 5px;border-radius:5px;white-space:nowrap;line-height:1.4}',
      '.zca-pbadge.zai{color:#7dd3fc;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3)}',
      '.zca-pbadge.bigmodel{color:#c4b5fd;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35)}',
      '.zca-pbadge.other{color:#9ca3af;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15)}',
      '.zca-edit{cursor:pointer;color:#8a8f96;border:none;background:transparent;font-size:12px;padding:2px 5px;border-radius:6px}',
      '.zca-edit:hover{color:#fff;background:rgba(255,255,255,.1)}',
      '.zca-row .cur{font-size:10px;color:#6ee7b7;white-space:nowrap}',
      '.zca-del{cursor:pointer;color:#8a8f96;border:none;background:transparent;font-size:16px;padding:2px 6px;border-radius:6px}',
      '.zca-del:hover{color:#f87171;background:rgba(248,113,113,.12)}',
      '.zca-del.armed{color:#f87171;background:rgba(248,113,113,.2);font-size:11px}',
      '#zcode-acct-actions{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.08)}',
      '.zca-btn{flex:1;padding:8px 0;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#e6e6e6;font-size:12px;cursor:pointer}',
      '.zca-btn:hover{background:rgba(255,255,255,.1)}',
      '.zca-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}',
      '.zca-btn.primary:hover{background:#1d4ed8}',
      '.zca-btn:disabled{opacity:.4;cursor:not-allowed}',
      '#zcode-acct-ad{padding:9px 16px;text-align:center;font-size:12.5px;font-weight:600;color:#dbeafe;cursor:pointer;background:linear-gradient(90deg,rgba(37,99,235,.22),rgba(139,92,246,.22))}',
      '#zcode-acct-ad:hover{background:linear-gradient(90deg,rgba(37,99,235,.38),rgba(139,92,246,.38));color:#fff}',
      '#zcode-acct-ad b{color:#7dd3fc}',
      '#zcode-acct-ad:hover b{color:#bae6fd}',
      '.zca-model-ad{display:block;cursor:pointer;font-size:12.5px;font-weight:600;color:#e0edff;text-align:center;padding:8px 14px;border:1px solid rgba(147,197,253,.55);border-radius:8px;background:linear-gradient(90deg,rgba(37,99,235,.30),rgba(139,92,246,.30))}',
      '.zca-model-ad:hover{background:linear-gradient(90deg,rgba(37,99,235,.45),rgba(139,92,246,.45));border-color:rgba(147,197,253,.9)}',
      '.zca-model-btn{padding:2px 10px;border-radius:6px;border:1px solid rgba(96,165,250,.45);background:rgba(37,99,235,.15);color:#93c5fd;font-size:12px;cursor:pointer}',
      '.zca-model-btn:hover{background:rgba(37,99,235,.35);color:#fff}',
      '.zca-empty{padding:22px 16px;text-align:center;color:#8a8f96;font-size:12px}',
      '@keyframes zca-fade{from{opacity:0}to{opacity:1}}'
    ].join('\n');
    var st = document.getElementById('zcode-acct-style');
    if (!st) {
      st = document.createElement('style');
      st.id = 'zcode-acct-style';
      (document.head || document.documentElement).appendChild(st);
    }
    st.textContent = css; // always refresh so style updates ship with the code
  }

  // -------------------------------------------------------------- api helpers
  function api(path, opts) {
    return fetch(API + path, Object.assign({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    }, opts || {})).then(function (r) { return r.json(); })
      .catch(function (e) { return { ok: false, error: '无法连接切换服务: ' + e.message }; });
  }

  // -------------------------------------------------------------- menu hook
  // Matches the account menu's logout/login item text across locales.
  var ACCOUNT_ITEM_RE = /^(断开连接|连接使用|退出登录|登出|Disconnect|Connect|Log ?out|Sign ?out)$/i;

  function findAccountItem() {
    var items = document.querySelectorAll('[role="menuitem"]');
    for (var i = 0; i < items.length; i++) {
      var t = (items[i].textContent || '').replace(/\s+/g, '');
      if (t && t.length <= 16 && ACCOUNT_ITEM_RE.test(t)) return items[i];
    }
    return null;
  }

  function injectMenuItem() {
    var anchor = findAccountItem();
    if (!anchor) return false;
    var parent = anchor.parentNode;
    if (!parent) return false;
    if (parent.querySelector('[data-zca-item]')) return true; // already there

    var item = anchor.cloneNode(true);
    item.textContent = '切换账号';
    item.setAttribute('data-zca-item', '1');
    item.removeAttribute('data-testid');
    item.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } catch (e) {}
      try { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } catch (e) {}
      openPanel();
    });
    // hover highlight like the native items (Radix toggles data-highlighted)
    item.addEventListener('mouseenter', function () { item.setAttribute('data-highlighted', ''); });
    item.addEventListener('mouseleave', function () { item.removeAttribute('data-highlighted'); });
    parent.insertBefore(item, anchor);
    return true;
  }

  function ensureMenuItem() {
    try { injectMenuItem(); } catch (e) {}
  }

  // Settings window: add an "账号切换" entry at the bottom of the settings
  // sidebar navigation (nav aria-label "主要项" / "Sections"), before the
  // "引导" / "Onboard" item.
  function injectSettingsButton() {
    try {
      var navs = document.querySelectorAll('nav[aria-label="主要项"], nav[aria-label="Sections"]');
      if (!navs.length) return;
      var nav = navs[0];
      if (nav.querySelector('[data-zca-settings]')) return;
      var children = nav.children;
      var anchor = null;
      for (var i = 0; i < children.length; i++) {
        var t = (children[i].textContent || '').replace(/\s+/g, '');
        if (/^(引导|Onboard)$/.test(t)) { anchor = children[i]; break; }
      }
      if (!anchor && children.length) anchor = children[children.length - 1];
      if (!anchor) return;
      var btn = anchor.cloneNode(true);
      btn.textContent = '账号切换';
      btn.setAttribute('data-zca-settings', '1');
      btn.removeAttribute('data-testid');
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openPanel();
      });
      anchor.parentNode.insertBefore(btn, anchor);
    } catch (e) {}
  }

  // Model providers settings page: inject TWO elements anchored to the
  // description "管理自定义模型供应商..." — a「切换账号」button and the ad.
  // Element-agnostic: the description may not be a <p> at runtime, so scan
  // common text elements and keep the SMALLEST (deepest) match. Every scan
  // reports diagnostics to /api/diag (throttled) for remote debugging.
  var lastDiagAt = 0;

  function diagReport(extra) {
    var now = Date.now();
    if (now - lastDiagAt < 60000) return; // throttle: at most 1 report / minute
    lastDiagAt = now;
    try {
      var report = Object.assign({
        t: new Date().toISOString(),
        pTotal: document.querySelectorAll('p').length,
        elTotal: document.querySelectorAll('*').length,
        iframes: document.querySelectorAll('iframe').length,
        adPresent: !!document.querySelector('[data-zca-ad-model]'),
        btnPresent: !!document.querySelector('[data-zca-model-btn]')
      }, extra || {});
      api('/api/diag', { method: 'POST', body: JSON.stringify({ source: 'model-page', report: report }) });
    } catch (e) {}
  }

  function findModelDesc() {
    var best = null, bestLen = 1e9;
    var els = document.querySelectorAll('p,span,div,h1,h2,h3,h4');
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').replace(/\s+/g, '');
      if (t.length < 200 &&
          (t.indexOf('管理自定义模型供应商') >= 0 || /Managecustommodelproviders/i.test(t))) {
        if (t.length < bestLen) { best = els[i]; bestLen = t.length; }
      }
    }
    return best;
  }

  function injectModelSettingsExtras() {
    var best = null, bestLen = 0;
    try {
      best = findModelDesc();
      bestLen = best ? (best.textContent || '').length : 0;
      if (best) {
        // --- ad: full-width banner on its OWN line, AFTER the header row ---
        // (inside the row it is squeezed into the flex line and invisible)
        var headerRow = best.parentElement;
        var ad = document.querySelector('[data-zca-ad-model]');
        if (!ad && headerRow && headerRow.parentNode) {
          ad = document.createElement('div');
          ad.setAttribute('data-zca-ad-model', '1');
          ad.className = 'zca-model-ad';
          ad.textContent = '✨ AI 模型共享，尽在 sharellm.net';
          ad.title = '点击访问 sharellm.net';
          ad.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openAdUrl();
          });
        }
        if (ad && headerRow && ad.parentNode !== headerRow.parentNode) {
          headerRow.parentNode.insertBefore(ad, headerRow.nextSibling);
        }
        // ---「切换账号」button: appended to the header row (rightmost) ---
        if (headerRow && !headerRow.querySelector('[data-zca-model-btn]')) {
          var btn = document.createElement('button');
          btn.setAttribute('data-zca-model-btn', '1');
          btn.className = 'zca-model-btn';
          btn.type = 'button';
          btn.textContent = '切换账号';
          btn.title = '打开账号切换面板';
          btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openPanel();
          });
          headerRow.appendChild(btn);
        }
      }
      if (best || document.querySelector('[data-zca-ad-model],[data-zca-model-btn]')) {
        diagReport({
          descFound: !!best,
          matchTag: best ? best.tagName : '',
          matchClass: best ? String(best.className).slice(0, 80) : '',
          matchLen: bestLen,
          parentTag: best && best.parentNode ? best.parentNode.tagName : ''
        });
      }
    } catch (e) {
      diagReport({ error: String(e && e.message || e) });
    }
  }

  // ------------------------------------------------------------------- panel
  var selectedId = null;
  var pendingDeleteId = null;
  var backdrop = null;

  function openAdUrl() {
    var url = 'https://sharellm.net';
    try {
      if (window.zcode && typeof window.zcode.openExternal === 'function') {
        window.zcode.openExternal(url);
        return;
      }
    } catch (e) {}
    try { window.open(url, '_blank'); } catch (e) {}
  }

  function providerLabel(p) {
    if (p === 'zai') return 'z.ai';
    if (p === 'bigmodel') return 'BigModel';
    return p || '';
  }

  function providerBadge(p) {
    if (!p) return '';
    var cls = (p === 'zai' || p === 'bigmodel') ? p : 'other';
    return '<span class="zca-pbadge ' + cls + '">' + esc(providerLabel(p)) + '</span>';
  }

  function ensurePanel() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'zcode-acct-backdrop';
    backdrop.innerHTML =
      '<div id="zcode-acct-card">' +
      '  <div id="zcode-acct-head"><b>切换账号</b><button id="zcode-acct-close" title="关闭">×</button></div>' +
      '  <div id="zcode-acct-msg"></div>' +
      '  <div id="zcode-acct-current"></div>' +
      '  <div id="zcode-acct-list"></div>' +
      '  <div id="zcode-acct-actions">' +
      '    <button class="zca-btn" id="zca-add">添加当前账号</button>' +
      '    <button class="zca-btn" id="zca-del">删除</button>' +
      '    <button class="zca-btn primary" id="zca-switch" disabled>切换并重启</button>' +
      '  </div>' +
      '  <div id="zcode-acct-ad" title="点击访问 sharellm.net">AI 模型共享，尽在 <b>sharellm.net</b></div>' +
      '</div>';
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closePanel(); });
    document.body.appendChild(backdrop);
    var q = function (s) { return backdrop.querySelector(s); };
    q('#zcode-acct-close').addEventListener('click', closePanel);
    q('#zca-add').addEventListener('click', onAdd);
    q('#zca-del').addEventListener('click', onDelete);
    q('#zca-switch').addEventListener('click', onSwitch);
    q('#zcode-acct-ad').addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      openAdUrl();
    });
    return backdrop;
  }

  function openPanel() {
    injectStyle();
    ensurePanel();
    backdrop.style.display = 'flex';
    selectedId = null;
    pendingDeleteId = null;
    setMsg(null);
    refresh();
  }

  function closePanel() {
    if (backdrop) backdrop.style.display = 'none';
  }

  function setMsg(text, isErr) {
    var m = backdrop.querySelector('#zcode-acct-msg');
    if (!text) { m.textContent = ''; m.className = ''; return; }
    m.textContent = text;
    m.className = isErr ? 'err' : 'info';
  }

  function refresh() {
    api('/api/state').then(render);
  }

  function render(s) {
    if (!backdrop || backdrop.style.display === 'none') return;
    var q = function (sel) { return backdrop.querySelector(sel); };
    var cur = s.active || {};
    q('#zcode-acct-current').innerHTML =
      '<span class="badge">当前</span>' +
      '<span class="who"><div class="n">' + esc(cur.name || '未登录') + ' ' + providerBadge(cur.provider) + '</div>' +
      '<div class="e">' + esc(cur.email || (s.loggedIn ? '' : '未登录任何账号')) + '</div></span>';

    var list = q('#zcode-acct-list');
    if (!s.profiles || !s.profiles.length) {
      list.innerHTML = '<div class="zca-empty">还没有保存的账号。<br>登录一个账号后点「添加当前账号」保存。</div>';
    } else {
      list.innerHTML = '';
      s.profiles.forEach(function (p) {
        var row = document.createElement('div');
        row.className = 'zca-row' + (selectedId === p.id ? ' sel' : '');
        var initial = (p.name || '?').slice(0, 1).toUpperCase();
        var armed = pendingDeleteId === p.id;
        row.innerHTML =
          '<span class="ava">' + esc(initial) + '</span>' +
          '<span class="who">' +
          '<div class="n">' + esc(p.name) + ' ' + providerBadge(p.provider) + '</div>' +
          '<div class="e">' + esc(p.email) + '</div>' +
          '<div class="r' + (p.remark ? '' : ' empty') + '">' + (p.remark ? esc(p.remark) : '点击 ✎ 添加备注') + '</div>' +
          '</span>' +
          (p.isActive ? '<span class="cur">● 当前</span>' : '') +
          '<button class="zca-edit" data-id="' + esc(p.id) + '" title="编辑备注">✎</button>' +
          '<button class="zca-del' + (armed ? ' armed' : '') + '" data-id="' + esc(p.id) + '">' +
          (armed ? '确认' : '×') + '</button>';
        row.addEventListener('click', function (e) {
          if (e.target && e.target.classList && (e.target.classList.contains('zca-del') || e.target.classList.contains('zca-edit'))) return;
          pendingDeleteId = null;
          setMsg(null);
          selectedId = p.id;
          var rows = list.querySelectorAll('.zca-row');
          for (var i = 0; i < rows.length; i++) rows[i].classList.remove('sel');
          row.classList.add('sel');
          q('#zca-switch').disabled = p.isActive;
        });
        list.appendChild(row);
      });
      list.querySelectorAll('.zca-del').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = b.getAttribute('data-id');
          if (pendingDeleteId === id) { doDelete(id); return; }
          pendingDeleteId = id;
          var name = (s.profiles.find(function (x) { return x.id === id; }) || {}).name || '该账号';
          setMsg('再点一次「确认」删除 ' + name, true);
          render(s);
        });
      });
      list.querySelectorAll('.zca-edit').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = b.getAttribute('data-id');
          var who = b.parentNode.querySelector('.who');
          var rdiv = who.querySelector('.r');
          var current = (s.profiles.find(function (x) { return x.id === id; }) || {}).remark || '';
          var input = document.createElement('input');
          input.className = 'rinput';
          input.type = 'text';
          input.maxLength = 80;
          input.placeholder = '备注…';
          input.value = current;
          rdiv.replaceWith(input);
          input.focus();
          var done = false;
          var commit = function () {
            if (done) return;
            done = true;
            var val = input.value.trim();
            api('/api/remark', { method: 'POST', body: JSON.stringify({ id: id, remark: val }) }).then(function (r) {
              if (r.ok) { setMsg('备注已保存', false); }
              else setMsg(r.error || '保存失败', true);
              refresh();
            });
          };
          input.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { done = true; refresh(); }
          });
          input.addEventListener('blur', commit);
        });
      });
    }
    q('#zca-switch').disabled = !selectedId;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function onAdd() {
    api('/api/capture', { method: 'POST', body: '{}' }).then(function (r) {
      if (r.ok) { setMsg('已保存当前账号', false); refresh(); }
      else setMsg(r.error || '添加失败', true);
    });
  }

  function doDelete(id) {
    api('/api/delete', { method: 'POST', body: JSON.stringify({ id: id }) }).then(function (r) {
      if (r.ok) { if (selectedId === id) selectedId = null; pendingDeleteId = null; setMsg('已删除', false); refresh(); }
      else setMsg(r.error || '删除失败', true);
    });
  }

  function onDelete() {
    if (!selectedId) { setMsg('请先选择一个账号', true); return; }
    if (pendingDeleteId === selectedId) { doDelete(selectedId); return; }
    pendingDeleteId = selectedId;
    setMsg('再点一次「删除」确认', true);
  }

  function onSwitch() {
    if (!selectedId) return;
    var q = function (sel) { return backdrop.querySelector(sel); };
    q('#zca-switch').disabled = true;
    q('#zca-switch').textContent = '正在切换…';
    api('/api/switch', { method: 'POST', body: JSON.stringify({ id: selectedId }) }).then(function (r) {
      if (r.ok) {
        q('#zca-switch').textContent = '正在重启…';
      } else {
        q('#zca-switch').textContent = '切换并重启';
        q('#zca-switch').disabled = false;
        setMsg(r.error || '切换失败', true);
      }
    });
  }

  // ------------------------------------------------------------------- boot
  function boot() {
    injectStyle();
    ensureMenuItem();
    injectSettingsButton();
    injectModelSettingsExtras();
    setInterval(function () { ensureMenuItem(); injectSettingsButton(); injectModelSettingsExtras(); }, SCAN_MS);
    window.__zcodeAccountSwitcher = { open: openPanel, refresh: refresh, ensureMenuItem: ensureMenuItem };
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
