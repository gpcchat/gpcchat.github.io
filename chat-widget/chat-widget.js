/* GPC Chat Widget v1 — no dependencies, no domain registration. */
(function () {
  'use strict';
  var scriptUrl = document.currentScript && document.currentScript.src;
  var active = null;
  var allowed = new Set(['eth_accounts', 'eth_requestAccounts', 'eth_chainId', 'net_version', 'personal_sign', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_sendTransaction', 'eth_estimateGas', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_blockNumber', 'eth_call', 'eth_getBalance', 'eth_getTransactionCount', 'eth_gasPrice', 'eth_maxPriorityFeePerGas']);
  function init(options) {
    options = options || {};
    if (!/^0x[0-9a-fA-F]{40}$/.test(options.groupId || '') || /^0x0{40}$/i.test(options.groupId)) throw new Error('GPCChat: invalid group address');
    if (!/^https?:$/.test(location.protocol)) throw new Error('GPCChat: use an HTTPS website');
    var base = options.chatUrl ? new URL(options.chatUrl, location.href) : new URL('./', scriptUrl);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('GPCChat: chatUrl must use HTTPS');
    if (active) active.destroy();
    var provider = options.provider || window.ethereum;
    var root = document.createElement('div');
    root.setAttribute('data-gpc-chat', '');
    var shadow = root.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = ':host{all:initial;position:fixed;z-index:2147483000;bottom:max(16px,env(safe-area-inset-bottom));right:16px;font-family:system-ui,sans-serif}button{cursor:pointer;font:600 14px system-ui;border:0;color:white;background:#176447;border-radius:28px;padding:16px 20px;box-shadow:0 4px 22px #0003}button:focus-visible{outline:3px solid #59d9a8;outline-offset:3px}.panel{position:absolute;bottom:64px;right:0;width:min(400px,calc(100vw - 24px));height:min(620px,calc(100dvh - 112px));background:#101b18;border:1px solid #496057;border-radius:18px;overflow:hidden;box-shadow:0 16px 48px #0004}.panel[hidden]{display:none}iframe{border:0;width:100%;height:100%;display:block}.loading{position:absolute;inset:0;display:grid;place-content:center;color:white;font:14px system-ui;pointer-events:none}';
    style.textContent += '@media(max-width:600px){:host{right:12px;bottom:max(12px,env(safe-area-inset-bottom))}.panel{position:fixed;left:8px!important;right:8px!important;top:calc(var(--gpc-viewport-top,0px) + 8px);bottom:auto;width:auto;height:calc(var(--gpc-viewport-height,100dvh) - 16px);border-radius:16px}:host([data-open="true"])>button{display:none}}';
    var viewport = window.visualViewport;
    function resizeViewport() { root.style.setProperty('--gpc-viewport-height', (viewport ? viewport.height : window.innerHeight) + 'px'); root.style.setProperty('--gpc-viewport-top', (viewport ? viewport.offsetTop : 0) + 'px'); }
    resizeViewport();
    if (viewport) { viewport.addEventListener('resize', resizeViewport); viewport.addEventListener('scroll', resizeViewport); }
    window.addEventListener('resize', resizeViewport);
    var bubble = document.createElement('button');
    bubble.type = 'button'; bubble.textContent = '群聊'; bubble.setAttribute('aria-label', '打开群聊'); bubble.setAttribute('aria-expanded', 'false');
    var panel = document.createElement('div'); panel.className = 'panel'; panel.hidden = true;
    var frame = document.createElement('iframe'); frame.title = 'GPC 指定群聊'; frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    var loading = document.createElement('div'); loading.className = 'loading'; loading.textContent = '正在加载群聊…';
    panel.append(frame, loading); shadow.append(style, panel, bubble);
    if (options.position === 'bottom-left') { root.style.left = '16px'; root.style.right = 'auto'; panel.style.left = '0'; panel.style.right = 'auto'; }
    (document.body || document.documentElement).appendChild(root);
    var session = '', opened = false, loaded = false, ready = false, destroyed = false, rpcBusy = false, loadTimer;
    function post(type, extra) { if (frame.contentWindow && ready) frame.contentWindow.postMessage(Object.assign({ channel: 'gpc-chat-v1', session: session, type: type }, extra), base.origin); }
    function load() {
      clearTimeout(loadTimer); ready = false; rpcBusy = false; loaded = true;
      session = crypto.randomUUID();
      var url = new URL(base.href); url.search = ''; url.hash = '';
      url.searchParams.set('gpcChatEmbed', '1'); url.searchParams.set('groupId', options.groupId);
      url.searchParams.set('parentOrigin', location.origin); url.searchParams.set('session', session);
      frame.style.visibility = 'hidden'; loading.hidden = false; loading.style.display = ''; loading.textContent = '正在加载群聊…';
      frame.src = url.href;
      loadTimer = setTimeout(function () { if (!ready) { loading.textContent = '加载失败，请收起后重新打开'; loaded = false; } }, 45000);
    }
    function open() { if (destroyed) return; opened = true; root.setAttribute('data-open', 'true'); resizeViewport(); panel.hidden = false; bubble.textContent = '收起群聊'; bubble.setAttribute('aria-expanded', 'true'); bubble.setAttribute('aria-label', '收起群聊'); if (!loaded) load(); post('visibility', { visible: true }); }
    function minimize() { if (destroyed) return; opened = false; root.setAttribute('data-open', 'false'); panel.hidden = true; bubble.textContent = '群聊'; bubble.setAttribute('aria-expanded', 'false'); bubble.setAttribute('aria-label', '打开群聊'); post('visibility', { visible: false }); bubble.focus(); }
    bubble.onclick = function () { if (opened) minimize(); else open(); };
    function reset() { bubble.textContent = opened ? '收起群聊' : '群聊'; if (loaded) load(); }
    async function receive(event) {
      var data = event.data;
      if (destroyed || event.source !== frame.contentWindow || event.origin !== base.origin || !data || data.channel !== 'gpc-chat-v1' || data.session !== session) return;
      if (data.type === 'ready') { ready = true; frame.style.visibility = 'visible'; clearTimeout(loadTimer); loading.style.display = 'none'; post('visibility', { visible: opened }); return; }
      if (data.type === 'minimize') { minimize(); return; }
      if (data.type === 'unread') { if (!opened && Number.isSafeInteger(data.count) && data.count >= 0) bubble.textContent = data.count ? '群聊 · ' + Math.min(data.count, 99) + (data.count > 99 ? '+' : '') : '群聊'; return; }
      if (data.type !== 'rpc' || !Number.isSafeInteger(data.id)) return;
      var requestSession = session;
      var reply = function (extra) { if (requestSession === session && !destroyed) post('rpc-result', Object.assign({ id: data.id }, extra)); };
      if (!data.args || !allowed.has(data.args.method)) { reply({ error: { code: 4200, message: '聊天组件不支持此钱包方法' } }); return; }
      if (!provider || typeof provider.request !== 'function') { reply({ error: { code: 4900, message: '请在钱包浏览器中打开，或由 DApp 传入已连接的钱包 provider' } }); return; }
      var interactive = ['eth_requestAccounts', 'personal_sign', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_sendTransaction'].includes(data.args.method);
      if (interactive && rpcBusy) { reply({ error: { code: -32002, message: '请先完成当前钱包请求' } }); return; }
      if (interactive) rpcBusy = true;
      try { reply({ result: await provider.request(data.args) }); }
      catch (error) { reply({ error: { code: Number(error.code) || -32603, message: String(error.message || '钱包请求失败').slice(0, 500) } }); }
      finally { if (interactive && requestSession === session) rpcBusy = false; }
    }
    window.addEventListener('message', receive);
    ['accountsChanged', 'chainChanged', 'disconnect'].forEach(function (event) { if (provider && provider.on) provider.on(event, reset); });
    function destroy() { if (destroyed) return; destroyed = true; window.removeEventListener('resize', resizeViewport); if (viewport) { viewport.removeEventListener('resize', resizeViewport); viewport.removeEventListener('scroll', resizeViewport); } clearTimeout(loadTimer); window.removeEventListener('message', receive); ['accountsChanged', 'chainChanged', 'disconnect'].forEach(function (event) { if (provider && provider.removeListener) provider.removeListener(event, reset); }); frame.src = 'about:blank'; root.remove(); if (active === api) active = null; }
    var api = { open: open, minimize: minimize, destroy: destroy };
    active = api;
    return api;
  }
  window.GPCChat = { init: init, open: function () { if (active) active.open(); }, minimize: function () { if (active) active.minimize(); }, destroy: function () { if (active) active.destroy(); } };
})();
