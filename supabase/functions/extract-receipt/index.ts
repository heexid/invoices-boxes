import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["merchant", "date", "currency", "subtotal", "tax", "total", "payment_method", "suggested_category", "notes", "confidence", "line_items"],
  properties: {
    merchant: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD when visible." },
    currency: { type: ["string", "null"], description: "Three-letter ISO 4217 code, such as IDR or USD." },
    subtotal: { type: ["number", "null"] },
    tax: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    payment_method: { type: ["string", "null"] },
    suggested_category: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    confidence: {
      type: "object", additionalProperties: false,
      required: ["merchant", "date", "currency", "subtotal", "tax", "total", "payment_method", "suggested_category"],
      properties: {
        merchant: { type: "number", minimum: 0, maximum: 1 }, date: { type: "number", minimum: 0, maximum: 1 },
        currency: { type: "number", minimum: 0, maximum: 1 }, subtotal: { type: "number", minimum: 0, maximum: 1 },
        tax: { type: "number", minimum: 0, maximum: 1 }, total: { type: "number", minimum: 0, maximum: 1 },
        payment_method: { type: "number", minimum: 0, maximum: 1 }, suggested_category: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    line_items: {
      type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["description", "quantity", "amount", "confidence"],
        properties: {
          description: { type: "string" }, quantity: { type: ["number", "null"] },
          amount: { type: ["number", "null"] }, confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  const apiKey = request.headers.get("apikey");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!authorization || !apiKey || !projectUrl) return json({ error: "Sign in before scanning a receipt." }, 401);
  if (!openAiKey) return json({ error: "Receipt scanning is not configured yet. You can still enter the receipt manually." }, 503);

  const supabase = createClient(projectUrl, apiKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Your session expired. Sign in again, then retry the scan." }, 401);

  let path: string;
  try {
    const body = await request.json();
    path = typeof body.path === "string" ? body.path : "";
  } catch {
    return json({ error: "The scan request was not valid." }, 400);
  }
  if (!path || path.startsWith("/") || path.split("/").includes("..") || path.split("/")[0] !== user.id) {
    return json({ error: "That receipt file is not available to this account." }, 403);
  }

  const { data: file, error: downloadError } = await supabase.storage.from("receipt-originals").download(path);
  if (downloadError || !file) return json({ error: "Couldn’t open the uploaded receipt. Try choosing it again." }, 400);
  const mimeType = file.type.toLowerCase().split(";")[0];
  const isPdf = mimeType === "application/pdf";
  const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!isPdf && !allowedImageTypes.has(mimeType)) return json({ error: "Choose a JPEG, PNG, WebP, or PDF receipt." }, 415);
  if (file.size > 20 * 1024 * 1024) return json({ error: "This file is over 20 MB. Choose a smaller image or PDF." }, 413);

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const base64 = btoa(binary);
    const receiptInput = isPdf
      ? { type: "input_file", filename: path.split("/").pop() ?? "receipt.pdf", file_data: `data:application/pdf;base64,${base64}` }
      : { type: "input_image", detail: "high", image_url: `data:${mimeType};base64,${base64}` };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        input: [{ role: "user", content: [
          { type: "input_text", text: "Read this receipt or invoice. Extract only values that are visible; use null for missing header values and an empty array when no line items can be read. Preserve the printed currency and sign convention. Return dates as YYYY-MM-DD. Line item amount means the line total, not unit price. Assign each confidence as a conservative 0-to-1 estimate. The receipt language may be any language." },
          receiptInput,
        ] }],
        text: { format: { type: "json_schema", name: "receipt_extraction", strict: true, schema: extractionSchema } },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const message = typeof result?.error?.message === "string" ? result.error.message : "The receipt scan could not be completed.";
      return json({ error: message }, response.status === 429 ? 429 : 502);
    }
    const outputText = result.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? []).find((item: { type?: string }) => item.type === "output_text")?.text;
    if (typeof outputText !== "string") return json({ error: "The scan did not return readable receipt details. You can enter them manually." }, 502);
    let extracted: unknown;
    try { extracted = JSON.parse(outputText); }
    catch { return json({ error: "The scan result could not be read. You can enter the receipt manually." }, 502); }
    return json({ draft: extracted });
  } catch (error) {
    console.error("extract-receipt failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The scan could not reach the extraction service. Your uploaded file is still saved; retry or enter it manually." }, 502);
  }
});
