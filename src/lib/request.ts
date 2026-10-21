import { NextResponse } from "next/server";

// Bound actual bytes as well as Content-Length (which callers can omit).
export async function readJson(request: Request): Promise<Record<string, any> | NextResponse> {
  const limit = 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413 });
  }
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  try {
    let size = 0;
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ error: "Request is too large" }, { status: 413 });
      }
      text += decoder.decode(part.value, { stream: true });
    }
    const body = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return body;
  } catch {
    return NextResponse.json({ error: "Expected a valid JSON object" }, { status: 400 });
  } finally {
    reader.releaseLock();
  }
}
