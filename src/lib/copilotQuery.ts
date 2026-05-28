import type { QueryResult } from './aiQueryEngine';

/** Split "question A Also question B" into separate copilot sub-queries. */
export function splitCopilotQuery(q: string): string[] {
  const parts = q.split(/\b(?:Also|Additionally)\b\s*:?/i).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [q];
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Optional one-line Gemini polish — must not invent numbers (payment / ERP trust). */
export async function geminiRefineErpAnswer(
  userQuery: string,
  result: QueryResult
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const facts = {
    title: result.title,
    summary: result.summary,
    kpis: result.kpis,
    rowCount: result.rows?.length ?? 0,
  };
  try {
    const res = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You assist a warehouse ERP admin in Mumbai (IST). The user asked: "${userQuery}".

Below is AUTHORITATIVE JSON from the live database. You must NOT change, invent, or contradict any numbers or PO counts.

${JSON.stringify(facts)}

Reply with exactly ONE short sentence (max 40 words), professional and clear. If rowCount is 0, acknowledge no matching rows. Do not list individual PO numbers unless they appear inside "summary".`,
              },
            ],
          },
        ],
      }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}
