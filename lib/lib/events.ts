export async function trackEvent(propertySlug: string, eventName: string, metadata?: Record<string, any>) {
  try {
    await fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertySlug,
        eventName,
        metadata: metadata ?? {},
      }),
    });
  } catch {
    // Intentionally ignore: analytics should never break UX.
  }
}
