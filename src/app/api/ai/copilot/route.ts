import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { classifyIntent, mergeContext, type ConversationContext } from '@/lib/aiIntentEngine';
import { executeIntent, type QueryResult } from '@/lib/aiQueryEngine';
import { formatNowIST } from '@/lib/utils';
import { splitCopilotQuery, geminiRefineErpAnswer } from '@/lib/copilotQuery';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const PAYMENT_INTENTS = new Set([
  'PAYMENT_DONE_TODAY',
  'PAYMENT_COMPLETED_RANGE',
  'PAYMENT_PENDING',
  'PAYMENT_ALL_LIST',
]);

async function geminiFreeform(userQuery: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  let geminiReply =
    "Hello! I am Lunar's ERP Chat Bot, powered by our live intelligence engine. Ask me about inventory, purchase orders, vendors, or cartons, and I'll fetch real-time data for you!";

  if (apiKey) {
    try {
      const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are Lunar's ERP Chat Bot, a highly intelligent assistant powered by Google Gemini. You are integrated into an Enterprise Resource Planning (ERP) system for a footwear manufacturing company called "Lunar's" in Mumbai, India. Current date and time (IST, Asia/Kolkata): ${formatNowIST()}. Always use Indian Standard Time when discussing dates or times. The user says: "${userQuery}". Respond kindly, naturally, and professionally. If the user asks a general knowledge question, answer it fully and accurately. If they say 'pookie' or other slang, play along nicely.`,
                },
              ],
            },
          ],
        }),
      });
      const geminiData = await geminiRes.json();
      if (geminiData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        geminiReply = geminiData.candidates[0].content.parts[0].text.trim();
      }
    } catch (e) {
      console.error('Gemini API Error:', e);
    }
  }
  return geminiReply;
}

function erpResponse(
  result: QueryResult,
  intent: string,
  entities: unknown,
  context: ConversationContext
) {
  return {
    success: true as const,
    type: result.type,
    title: result.title,
    summary: result.summary,
    rows: result.rows,
    kpis: result.kpis,
    hint: result.hint,
    narrative: result.narrative,
    intent,
    entities,
    context,
    reply: result.summary,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin')
      return NextResponse.json({ error: 'Forbidden: AI Copilot is restricted to administrators.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const query: string = body?.query?.trim() || '';
    let ctx: ConversationContext = body?.context || { turnCount: 0 };

    if (!query) return NextResponse.json({ error: 'Query is required.' }, { status: 400 });

    const parts = splitCopilotQuery(query);

    const processPart = async (part: string) => {
      const intentResult = classifyIntent(part, ctx);

      if (intentResult.needsClarification && intentResult.clarificationQuestion) {
        return {
          kind: 'clarify' as const,
          payload: {
            success: true,
            type: 'clarify',
            title: 'Clarification Needed',
            reply: intentResult.clarificationQuestion,
            intent: 'CLARIFY',
            context: ctx,
          },
        };
      }

      if (intentResult.intent === 'SMALLTALK' || intentResult.intent === 'UNKNOWN') {
        const geminiReply = await geminiFreeform(part);
        ctx = mergeContext(ctx, intentResult.entities, intentResult.intent);
        return {
          kind: 'single' as const,
          payload: {
            success: true,
            type: 'text',
            title: "✨ Lunar's AI Engine",
            summary: geminiReply,
            reply: geminiReply,
            intent: intentResult.intent,
            entities: intentResult.entities,
            context: ctx,
          },
        };
      }

      let result = await executeIntent(intentResult.intent, intentResult.entities, ctx);
      if (PAYMENT_INTENTS.has(intentResult.intent)) {
        const n = await geminiRefineErpAnswer(part, result);
        if (n) result = { ...result, narrative: n };
      }
      ctx = mergeContext(ctx, intentResult.entities, intentResult.intent);
      return {
        kind: 'erp' as const,
        payload: erpResponse(result, intentResult.intent, intentResult.entities, ctx),
      };
    };

    if (parts.length === 1) {
      const out = await processPart(parts[0]);
      if (out.kind === 'clarify') return NextResponse.json(out.payload);
      if (out.kind === 'single') return NextResponse.json(out.payload);
      return NextResponse.json(out.payload);
    }

    const answers: Array<{
      type: string;
      title: string;
      summary: string;
      rows?: any[];
      kpis?: any[];
      hint?: string;
      narrative?: string;
    }> = [];

    for (const part of parts) {
      const out = await processPart(part);
      if (out.kind === 'clarify') return NextResponse.json(out.payload);
      if (out.kind === 'single') {
        answers.push({
          type: out.payload.type,
          title: out.payload.title,
          summary: out.payload.summary,
        });
      } else {
        answers.push({
          type: out.payload.type,
          title: out.payload.title,
          summary: out.payload.summary,
          rows: out.payload.rows,
          kpis: out.payload.kpis,
          hint: out.payload.hint,
          narrative: out.payload.narrative,
        });
      }
    }

    return NextResponse.json({
      success: true,
      multi: true,
      answers,
      context: ctx,
    });
  } catch (err: any) {
    console.error('[COPILOT ERROR]', err.message);
    return NextResponse.json({ error: 'Unable to query ERP data at this time. Please try again.' }, { status: 500 });
  }
}
