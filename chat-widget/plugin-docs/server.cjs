"use strict";
const crypto = require("node:crypto");
function createServerClient(options) {
  if (!options || !/^gpk_/.test(options.apiKey || ""))
    throw new Error("需要插件服务端密钥");
  const base = (options.apiBase || "https://api.gpcchat.com/api").replace(
    /\/$/,
    "",
  );
  const fetcher = options.fetch || globalThis.fetch;
  if (!fetcher) throw new Error("需要 Node.js 20+ 或提供 fetch");
  async function call(path, method, body, binary) {
    const response = await fetcher(base + "/plugins/open" + path, {
      method,
      headers: {
        Authorization: "Bearer " + options.apiKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20000),
    });
    if (binary && response.ok) return response.arrayBuffer();
    const result = await response.json();
    if (!response.ok || !result.success)
      throw Object.assign(new Error(result.code || "PLUGIN_REQUEST_FAILED"), {
        code: result.code,
        status: response.status,
      });
    return result.data;
  }
  const id = encodeURIComponent;
  return {
    events: (after = "") => call("/events?after=" + id(after), "GET"),
    orders: {
      create: (input) => call("/orders", "POST", input),
      get: (orderId) => call("/orders/" + id(orderId), "GET"),
    },
    cards: {
      send: (input) => call("/bot-messages", "POST", input),
      get: (messageId) => call("/bot-messages/" + id(messageId), "GET"),
      update: (messageId, patch) =>
        call("/bot-messages/" + id(messageId), "PATCH", patch),
    },
    notifications: {
      send: (input) => call("/notifications", "POST", input),
      get: (notificationId) =>
        call("/notifications/" + id(notificationId), "GET"),
    },
    files: {
      download: (fileId) =>
        call("/files/" + id(fileId), "GET", undefined, true),
    },
    links: { create: (input) => call("/scenes", "POST", input) },
  };
}
function verifyWebhook({
  secret,
  timestamp,
  eventId,
  signature,
  rawBody,
  now = Date.now(),
}) {
  if (
    typeof secret !== "string" ||
    !secret ||
    typeof timestamp !== "string" ||
    !/^\d{10,13}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !eventId ||
    !(rawBody instanceof Uint8Array) ||
    typeof signature !== "string" ||
    !/^[0-9a-f]{64}$/.test(signature)
  )
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + eventId + ".")
    .update(rawBody)
    .digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
module.exports = { createServerClient, verifyWebhook };
