/**
 * Client helper for the streaming /api/chat endpoint. POSTs the request, then
 * parses the `text/event-stream` response, invoking handlers as text deltas and
 * the final usage event arrive. Throws on a non-streaming error response (e.g.
 * 402 insufficient balance) or a mid-stream error event, with the server message.
 */

export interface ChatUsage {
  input: number;
  output: number;
  total: number;
  costUsd?: number;
}

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "error"; error: string }
  | { type: "done"; usage: ChatUsage; deducted: boolean; deductError: string | null };

interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (usage: ChatUsage, deducted: boolean, deductError: string | null) => void;
}

export async function streamChat(body: unknown, handlers: StreamHandlers): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Errors come back as plain JSON (balance too low, no key, bad request, etc.)
  if (!res.ok || !res.body) {
    let msg = "Request failed";
    try {
      const data = await res.json();
      msg = data.error ?? msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      let evt: StreamEvent;
      try {
        evt = JSON.parse(json) as StreamEvent;
      } catch {
        continue;
      }
      if (evt.type === "delta") handlers.onDelta(evt.text);
      else if (evt.type === "error") streamError = evt.error;
      else if (evt.type === "done") handlers.onDone(evt.usage, evt.deducted, evt.deductError);
    }
  }

  if (streamError) throw new Error(streamError);
}
