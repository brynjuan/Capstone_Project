export async function notifyRealtime(event = "visitor-updated") {
  const notifyUrl = process.env.WS_NOTIFY_URL || "http://127.0.0.1:3001/notify";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    await fetch(notifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      signal: controller.signal,
    });
  } catch {
    // Realtime is best-effort; the normal revalidation path still keeps data correct.
  } finally {
    clearTimeout(timeout);
  }
}
