(function (root, factory) {
  var sdk = factory();
  if (typeof module === "object" && module.exports) module.exports = sdk;
  root.GPCPluginSDK = sdk;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function createFrameProvider() {
    var peer =
      typeof window !== "undefined" &&
      (window.parent !== window ? window.parent : window.opener);
    if (!peer)
      throw Object.assign(new Error("请在 GPC 安装并打开插件"), { code: 4200 });
    var pending = new Map(),
      next = 1,
      parentOrigin = "";
    try {
      parentOrigin = new URL(document.referrer).origin;
    } catch (_) {}
    var receive = function (event) {
      if (
        event.source !== peer ||
        (parentOrigin && event.origin !== parentOrigin)
      )
        return;
      var data = event.data;
      if (!data || data.type !== "gpc-plugin:response") return;
      var request = pending.get(data.id);
      if (!request) return;
      parentOrigin = event.origin;
      pending.delete(data.id);
      clearTimeout(request.timeout);
      if (data.error)
        request.reject(
          Object.assign(new Error(data.error.message), data.error),
        );
      else request.resolve(data.result);
    };
    window.addEventListener("message", receive);
    return {
      request: function (args) {
        return new Promise(function (resolve, reject) {
          var id = "plugin-" + next++;
          var timeout = setTimeout(
            function () {
              pending.delete(id);
              reject(
                Object.assign(new Error("插件请求超时"), { code: -32603 }),
              );
            },
            /^gpc_plugin_(orders_pay|notifications_subscribe|files_choose|media_choose|camera_scan)$/.test(
              args.method,
            )
              ? 610000
              : 190000,
          );
          pending.set(id, {
            resolve: resolve,
            reject: reject,
            timeout: timeout,
          });
          if (
            /^(eth_requestAccounts|eth_sendTransaction|eth_sign|personal_sign|wallet_|gpc_shareToGroup|gpc_plugin_(orders_pay|notifications_subscribe|files_choose|media_choose|camera_scan))/.test(
              args.method,
            )
          ) {
            try {
              peer.focus();
            } catch (_) {}
          }
          peer.postMessage(
            {
              type: "gpc-plugin:request",
              id: id,
              method: args.method,
              params: args.params,
            },
            parentOrigin || "*",
          );
        });
      },
      destroy: function () {
        window.removeEventListener("message", receive);
        pending.forEach(function (r) {
          clearTimeout(r.timeout);
          r.reject(Object.assign(new Error("SDK 已关闭"), { code: 4001 }));
        });
        pending.clear();
      },
    };
  }
  function createPlugin(options) {
    options = options || {};
    var provider =
      options.provider ||
      (typeof window !== "undefined" &&
      window.ethereum &&
      (window.ethereum.isGPCWallet ||
        (window.parent === window && !window.opener))
        ? window.ethereum
        : createFrameProvider());
    if (!provider || typeof provider.request !== "function")
      throw new Error("缺少 GPC Provider");
    function request(method, value) {
      return provider.request({
        method: method,
        params: value === undefined ? [] : [value],
      });
    }
    var subscriptions = new Set();
    var api = {
      getContext: function () {
        return request("gpc_plugin_getContext");
      },
      getCapabilities: function () {
        return request("gpc_plugin_getCapabilities");
      },
      getAuthorization: function () {
        return request("gpc_plugin_getAuthorization");
      },
      getLaunchContext: function () {
        return request("gpc_plugin_getLaunchContext");
      },
      orders: {
        get: function (orderId) {
          return request("gpc_plugin_orders_get", { orderId: orderId });
        },
        pay: function (orderId) {
          return request("gpc_plugin_orders_pay", { orderId: orderId });
        },
        cancel: function (orderId) {
          return request("gpc_plugin_orders_cancel", { orderId: orderId });
        },
        submit: function (orderId, txHash) {
          return request("gpc_plugin_orders_submit", {
            orderId: orderId,
            txHash: txHash,
          });
        },
      },
      notifications: {
        topics: function () {
          return request("gpc_plugin_notifications_topics");
        },
        subscriptions: function () {
          return request("gpc_plugin_notifications_subscriptions");
        },
        subscribe: function (topic) {
          return request("gpc_plugin_notifications_subscribe", {
            topic: topic,
          });
        },
        unsubscribe: function (topic) {
          return request("gpc_plugin_notifications_unsubscribe", {
            topic: topic,
          });
        },
      },
      links: {
        create: function (options) {
          return request("gpc_plugin_links_create", options);
        },
      },
      files: {
        choose: function (options) {
          return request("gpc_plugin_files_choose", options || {});
        },
      },
      media: {
        choose: function () {
          return request("gpc_plugin_media_choose");
        },
      },
      camera: {
        scan: function () {
          return request("gpc_plugin_camera_scan");
        },
      },
      login: function (challenge) {
        return request("gpc_login", challenge);
      },
      shareToGroup: function (card) {
        return request("gpc_shareToGroup", card);
      },
      storage: {
        get: function (key) {
          return request("gpc_plugin_storage_get", { key: key }).then(
            function (row) {
              return row.value === null ? null : JSON.parse(row.value);
            },
          );
        },
        set: function (key, value) {
          var text = JSON.stringify(value);
          if (typeof text !== "string")
            return Promise.reject(new Error("存储值需要可序列化为 JSON"));
          return request("gpc_plugin_storage_set", { key: key, value: text });
        },
        remove: function (key) {
          return request("gpc_plugin_storage_remove", { key: key });
        },
      },
      wallet: {
        request: function (args) {
          if (
            !args ||
            typeof args.method !== "string" ||
            !/^(eth_|wallet_|net_|web3_)/.test(args.method)
          )
            return Promise.reject(new Error("无效的钱包方法"));
          return provider.request(args);
        },
      },
      device: {
        getCapabilities: function () {
          return request("gpc_device_getCapabilities");
        },
      },
      vibrate: function (options) {
        return request("gpc_vibrate", options);
      },
      cancelVibration: function () {
        return request("gpc_cancelVibration");
      },
      requestFullscreen: function () {
        return request("gpc_setFullscreen", true);
      },
      exitFullscreen: function () {
        return request("gpc_setFullscreen", false);
      },
      gravity: {
        start: function (options) {
          return request("gpc_gravity_start", options);
        },
        stop: function () {
          return request("gpc_gravity_stop");
        },
        calibrate: function () {
          return request("gpc_gravity_calibrate");
        },
        onChange: function (handler) {
          return api.on("gravityChanged", handler);
        },
        onStop: function (handler) {
          return api.on("gravityStopped", handler);
        },
      },
      ads: {
        getCapabilities: function () {
          return request("gpc_ads_getCapabilities");
        },
        load: function (options) {
          return request("gpc_ads_load", options);
        },
        show: function (options) {
          return request("gpc_ads_show", options);
        },
      },
      on: function (event, handler) {
        if (typeof provider.on !== "function") return function () {};
        provider.on(event, handler);
        var stop = function () {
          if (!subscriptions.delete(stop)) return;
          if (typeof provider.removeListener === "function")
            provider.removeListener(event, handler);
        };
        subscriptions.add(stop);
        return stop;
      },
      destroy: function () {
        subscriptions.forEach(function (stop) {
          stop();
        });
        if (typeof provider.destroy === "function" && !options.provider)
          provider.destroy();
      },
    };
    return api;
  }
  return { createPlugin: createPlugin };
});
