/**
 * AI Intent Engine — Natural Language Understanding Layer
 * Classifies user queries into structured intents with entity extraction.
 * No hardcoded responses here — pure classification and entity extraction.
 */

export interface ConversationContext {
  articleCode?: string;
  colour?: string;
  size?: number;
  vendorName?: string;
  lastIntent?: string;
  turnCount: number;
}

export interface IntentResult {
  intent: string;
  confidence: 'high' | 'medium' | 'low';
  entities: ExtractedEntities;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export interface ExtractedEntities {
  articleCode?: string;
  colour?: string;
  size?: number;
  vendorName?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  limit?: number;
  /** YYYY-MM-DD (IST calendar dates from user text) */
  paymentRangeStart?: string;
  paymentRangeEnd?: string;
}

// ─── Colour synonyms ──────────────────────────────────────────────────────────
const COLOUR_MAP: Record<string, string> = {
  red: 'RED', crimson: 'RED', maroon: 'RED',
  blue: 'BLUE', navy: 'BLUE', royal: 'ROYAL_BLUE', 'royal blue': 'ROYAL_BLUE',
  black: 'BLACK', white: 'WHITE', green: 'GREEN', yellow: 'YELLOW',
  brown: 'BROWN', grey: 'GREY', gray: 'GREY', orange: 'ORANGE',
  pink: 'PINK', purple: 'PURPLE', tan: 'TAN', beige: 'BEIGE',
};

// ─── Entity extractors ────────────────────────────────────────────────────────
export function extractArticleCode(q: string): string | undefined {
  // Match patterns like JF4444, A-229, B108, JF 4444
  const m = q.match(/\b([A-Za-z]{1,3}[-\s]?\d{3,6})\b/i);
  return m ? m[1].toUpperCase().replace(/\s/g, '') : undefined;
}

export function extractColour(q: string): string | undefined {
  const lower = q.toLowerCase();
  // Try multi-word colours first
  for (const [key, val] of Object.entries(COLOUR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return undefined;
}

export function extractSize(q: string): number | undefined {
  const m = q.match(/\bsize\s*(\d{1,2})\b/i) || q.match(/\bsz\s*(\d{1,2})\b/i);
  if (m) {
    const s = parseInt(m[1]);
    if (s >= 4 && s <= 14) return s;
  }
  return undefined;
}

export function extractDateRange(q: string): 'today' | 'week' | 'month' | 'all' {
  const t = q.toLowerCase();
  if (/today|this day/.test(t)) return 'today';
  if (/this week|7 day|last 7/.test(t)) return 'week';
  if (/this month|30 day|last 30/.test(t)) return 'month';
  return 'today'; // default to today for operational context
}

export function extractVendorName(q: string, context?: ConversationContext): string | undefined {
  // Try to extract a capitalized proper noun that might be a vendor name
  const m = q.match(/(?:vendor|supplier|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (m) return m[1];
  return context?.vendorName;
}

export function extractLimit(q: string): number {
  const m = q.match(/\btop\s*(\d+)\b/i) || q.match(/\b(\d+)\s+(?:items?|result|record|article)/i);
  return m ? Math.min(parseInt(m[1]), 50) : 10;
}

/** Parse dd/mm/yyyy or dd-mm-yyyy range → ISO YYYY-MM-DD (for SQL date()). */
export function extractPaymentDateRange(q: string): { start: string | null; end: string | null } {
  const toIso = (d: string, mo: string, y: string) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const re =
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(?:to|through|until|–|-|—)\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/i;
  const m = q.match(re);
  if (!m) return { start: null, end: null };
  let start = toIso(m[1], m[2], m[3]);
  let end = toIso(m[4], m[5], m[6]);
  if (start > end) [start, end] = [end, start];
  return { start, end };
}

// ─── Context merge ────────────────────────────────────────────────────────────
export function mergeContext(
  prev: ConversationContext,
  newEntities: ExtractedEntities,
  newIntent: string
): ConversationContext {
  return {
    articleCode: newEntities.articleCode || prev.articleCode,
    colour: newEntities.colour || prev.colour,
    size: newEntities.size || prev.size,
    vendorName: newEntities.vendorName || prev.vendorName,
    lastIntent: newIntent,
    turnCount: (prev.turnCount || 0) + 1,
  };
}

// ─── Main intent classifier ───────────────────────────────────────────────────
export function classifyIntent(q: string, context?: ConversationContext): IntentResult {
  const t = q.toLowerCase().trim();

  const entities: ExtractedEntities = {
    articleCode: extractArticleCode(q) || context?.articleCode,
    colour: extractColour(q) || (extractArticleCode(q) ? undefined : context?.colour),
    size: extractSize(q),
    dateRange: extractDateRange(q),
    limit: extractLimit(q),
    vendorName: extractVendorName(q, context),
  };

  const hasPaymentContext =
    /payment|payments|paid|payout|amount\s*paid|invoice|accountant|settled|cleared|liabilit|remittance|audited|cheque|neft|rtgs/i.test(
      t
    );
  const paymentRange = extractPaymentDateRange(q);

  // If follow-up is just a colour (e.g. "only blue"), inherit article from context
  const isColourFollowUp = !extractArticleCode(q) && !!extractColour(q) && !!context?.articleCode;
  const isFollowUp = isColourFollowUp || (!extractArticleCode(q) && t.length < 20 && !!context?.lastIntent);

  // 0. Payment / accountant — run before "how much" → inventory fuzzy false positives
  if (hasPaymentContext && paymentRange.start && paymentRange.end) {
    return {
      intent: 'PAYMENT_COMPLETED_RANGE',
      confidence: 'high',
      entities: { ...entities, paymentRangeStart: paymentRange.start, paymentRangeEnd: paymentRange.end },
      needsClarification: false,
    };
  }
  if (
    hasPaymentContext &&
    (/today|this\s*day|todays?/i.test(t) ||
      /how\s*much.*payment|payment.*how\s*much|how\s*much.*paid|paid.*today|payment.*(done|completed|made).*(today|this)|today.*payment.*(done|completed|made|received)/i.test(
        t
      ))
  ) {
    return { intent: 'PAYMENT_DONE_TODAY', confidence: 'high', entities, needsClarification: false };
  }
  if (/payment.?done.?today|payment.?today|today.?payments?|paid.?today|cleared.?today|settled.?today/i.test(t)) {
    return { intent: 'PAYMENT_DONE_TODAY', confidence: 'high', entities, needsClarification: false };
  }

  // 1. Strict regex patterns for high-precision immediate matching
  if (/low.?stock|stock.?low|short(age)?|out.?of.?stock|replenish|reorder|running.?out|finish(ing)?/.test(t))
    return { intent: 'LOW_STOCK', confidence: 'high', entities, needsClarification: false };

  if (/slow.?mov|dead.?stock|not.?mov|stagnant/.test(t))
    return { intent: 'SLOW_MOVING', confidence: 'high', entities, needsClarification: false };

  if (/predict|forecast|will.?finish|run.?out.?when|stockout|when.?finish/.test(t))
    return { intent: 'STOCK_PREDICTION', confidence: 'high', entities, needsClarification: false };

  if (/size\s*\d|which.?size|size.?distribution|size.?demand|size.?breakdown/.test(t))
    return { intent: 'SIZE_LOOKUP', confidence: 'high', entities, needsClarification: false };

  if (/upper.?stock|out.?stock|general.?stock|general.?warehouse|warehouse.?stock/.test(t))
    return { intent: 'UPPERSTOCK_INVENTORY', confidence: 'high', entities, needsClarification: false };

  // Article lookup — with code, colour follow-up, or inherited context
  if (entities.articleCode || isColourFollowUp) {
    if (isFollowUp && context?.lastIntent === 'ARTICLE_LOOKUP')
      return { intent: 'ARTICLE_LOOKUP', confidence: 'high', entities, needsClarification: false };
    return { intent: 'ARTICLE_LOOKUP', confidence: 'high', entities, needsClarification: false };
  }

  if (/show.?stock|stock.?of|inventory.?for|check.?stock|how.?much.?stock/.test(t))
    return { intent: 'INVENTORY_SUMMARY', confidence: 'high', entities, needsClarification: false };

  if (/carton.?(today|now|this day)|how.?many.?carton|packed.?today|carton.?count/.test(t))
    return { intent: 'CARTONS_TODAY', confidence: 'high', entities, needsClarification: false };

  if (/total.?carton|all.?time.?carton|carton.?total|carton.?all/.test(t))
    return { intent: 'CARTON_TOTAL', confidence: 'high', entities, needsClarification: false };

  if (/carton.?config|packing.?config|how.?many.?config|setup/.test(t))
    return { intent: 'CARTON_CONFIG', confidence: 'high', entities, needsClarification: false };

  if (/pending.?(approval|po|order)|po.?pending|waiting.?approval|approve|approv/.test(t))
    return { intent: 'PENDING_APPROVALS', confidence: 'high', entities, needsClarification: false };

  if (/delay(ed)?.?(po|order|purchase)|po.?delay|overdue.?order|late.?po/.test(t))
    return { intent: 'DELAYED_POS', confidence: 'high', entities, needsClarification: false };

  if (/procurement.?summary|po.?summary|purchase.?summary|total.?po/.test(t))
    return { intent: 'PROCUREMENT_SUMMARY', confidence: 'high', entities, needsClarification: false };

  if (/approved.?history|approved.?po|approved.?purchase|approved.?(orders?|history)|po.?history/.test(t))
    return { intent: 'APPROVED_PO_HISTORY', confidence: 'high', entities, needsClarification: false };

  if (/payment.?pending|pending.?payments?|total.?pending|pending.?amount|unpaid/.test(t))
    return { intent: 'PAYMENT_PENDING', confidence: 'high', entities, needsClarification: false };

  if (/payment.?(completed|done|paid).?and.?pending|pending.?and.?(completed|paid).?list|all.?payments/.test(t))
    return { intent: 'PAYMENT_ALL_LIST', confidence: 'high', entities, needsClarification: false };

  if (/vendor.?delay|delay.?vendor|slow.?supplier|supplier.?risk|which.?vendor.?delay|worst.?vendor/.test(t))
    return { intent: 'VENDOR_DELAY', confidence: 'high', entities, needsClarification: false };

  if (/top.?vendor|best.?vendor|highest.?reliab|vendor.?rank|best.?supplier/.test(t))
    return { intent: 'TOP_VENDOR', confidence: 'high', entities, needsClarification: false };

  if (/vendor.?score|vendor.?performance|supplier.?score|scorecard/.test(t))
    return { intent: 'VENDOR_SCORECARD', confidence: 'high', entities, needsClarification: false };

  if (/scan.?(today|activity|count|how.?many)|inward.?scan|today.?scan/.test(t))
    return { intent: 'SCAN_TODAY', confidence: 'high', entities, needsClarification: false };

  if (/top.?operator|best.?operator|who.?scanned.?most|most.?scan|operator.?rank/.test(t))
    return { intent: 'TOP_OPERATOR', confidence: 'high', entities, needsClarification: false };

  if (/operator|worker|who.?scanned|scan.?by/.test(t))
    return { intent: 'OPERATOR_ACTIVITY', confidence: 'medium', entities, needsClarification: false };

  if (/outward|dispatch(ed)?|shipped/.test(t))
    return { intent: 'OUTWARD_TODAY', confidence: 'high', entities, needsClarification: false };

  if (/inward|received|receipt|incoming/.test(t))
    return { intent: 'INWARD_TODAY', confidence: 'high', entities, needsClarification: false };

  if (/movement|fastest.?moving|highest.?moving|best.?seller|high.?demand|most.?popular|selling.?fast|highest.?sale/.test(t))
    return { intent: 'ARTICLE_MOVEMENT', confidence: 'high', entities, needsClarification: false };

  if (/daily.?summary|today.?summary|today.?report|daily.?report|what.?happen|overview/.test(t))
    return { intent: 'DAILY_SUMMARY', confidence: 'high', entities, needsClarification: false };

  if (/anomaly|suspicious|unusual|alert|risk|flag/.test(t))
    return { intent: 'ANOMALY_CHECK', confidence: 'high', entities, needsClarification: false };

  if (/v.?strap|vstrap|strap/.test(t))
    return { intent: 'VSTRAP_SUMMARY', confidence: 'high', entities, needsClarification: false };

  if (/help|what.?can.?you|commands?|guide|what.?do.?you|what.?you.?know/.test(t))
    return { intent: 'HELP', confidence: 'high', entities, needsClarification: false };

  if (/what.?time|current.?time|time.?now|what.?date|today.?date|ist.?time|mumbai.?time|date.?and.?time|what.?day.?is|tell.?me.?the.?time/.test(t))
    return { intent: 'CURRENT_DATETIME', confidence: 'high', entities, needsClarification: false };

  if (/hi|hello|hey|morning|evening|afternoon|pookie|awesome|good|great|thanks|thank.?you|love.?you|smart|stupid|idiot/.test(t))
    return { intent: 'SMALLTALK', confidence: 'high', entities, needsClarification: false };

  // 2. Fuzzy Keyword Semantic Scoring Fallback to understand "whatever I ask"
  const intentKeywords: Record<string, string[]> = {
    UPPERSTOCK_INVENTORY: ['upperstock', 'upper stock', 'outstock', 'general stock', 'general warehouse', 'warehouse stock', 'outstock ledger', 'main storage', 'storage balance', 'warehouse inventory', 'factory stock', 'overall stock', 'stock balance'],
    LOW_STOCK: ['low', 'shortage', 'deficit', 'alert', 'running out', 'replenish', 'reorder', 'finish', 'under', 'less than', 'empty', 'draining', 'almost over', 'about to finish', 'critical stock', 'out of stock', 'insufficient'],
    SLOW_MOVING: ['slow', 'dead', 'stagnant', 'not moving', 'unused', 'stuck', 'aging', 'old stock', 'dusty', 'unsold', 'hard to sell', 'least moving'],
    STOCK_PREDICTION: ['predict', 'forecast', 'estimate', 'future', 'when', 'trend', 'depletion', 'run out', 'how long will it last', 'expected', 'runout date', 'stockout warning'],
    SIZE_LOOKUP: ['size', 'sz', 'breakdown', 'dimension', 'distribution', 'scale', 'measurements', 'what sizes', 'fitting', 'shoe sizes'],
    INVENTORY_SUMMARY: ['stock', 'inventory', 'article', 'item', 'ledger', 'balance', 'qty', 'quantity', 'pair', 'pair count', 'details', 'check stock', 'how much', 'what is the count', 'availability', 'on hand', 'stock level'],
    CARTONS_TODAY: ['carton', 'box', 'package', 'packed today', 'dispatch count', 'cartons count', 'sealed', 'boxing', 'packed pairs', 'daily cartons', 'how many boxes'],
    CARTON_TOTAL: ['total cartons', 'all cartons', 'carton totals', 'overall packed', 'historical cartons', 'total boxes'],
    CARTON_CONFIG: ['carton config', 'packing config', 'setup', 'template', 'packing rule', 'how many pairs in box', 'packing template', 'carton master', 'box setup'],
    PENDING_APPROVALS: ['pending', 'approval', 'approve', 'waiting', 'return', 'verify', 'to be approved', 'unapproved', 'needs my sign', 'admin approval', 'pending verification'],
    DELAYED_POS: ['delay', 'overdue', 'late po', 'late order', 'delayed order', 'waiting long', 'too much time', 'not received yet', 'pending too long'],
    PROCUREMENT_SUMMARY: ['procurement', 'po summary', 'purchase summary', 'order summary', 'po count', 'purchasing', 'buying', 'materials ordered', 'ordered items'],
    APPROVED_PO_HISTORY: ['approved history', 'approved po', 'approved purchase', 'po history', 'order history', 'past orders', 'completed po', 'finalized orders'],
    PAYMENT_PENDING: ['payment pending', 'pending payment', 'total pending', 'pending amount', 'unpaid', 'due', 'balance amount', 'yet to pay', 'outstanding balance'],
    PAYMENT_DONE_TODAY: [
      'payment done today',
      'payment today',
      'today payments',
      'completed today',
      'paid today',
      'cleared today',
      'amount paid',
      'settled today',
      'payment completed',
      'completed payment',
    ],
    PAYMENT_COMPLETED_RANGE: [
      'payment list',
      'completed payment',
      'payments between',
      'payment from',
      'payment range',
      'paid between',
    ],
    VENDOR_DELAY: ['vendor delay', 'supplier delay', 'slow vendor', 'worst vendor', 'delaying', 'which vendor is late', 'late supplier', 'delayed delivery'],
    TOP_VENDOR: ['top vendor', 'best vendor', 'best supplier', 'top supplier', 'reliable vendor', 'who is the best', 'fastest supplier', 'good vendor'],
    VENDOR_SCORECARD: ['vendor scorecard', 'vendor performance', 'vendor rating', 'supplier score', 'supplier performance', 'grade', 'reliability', 'vendor index', 'how are suppliers doing'],
    SCAN_TODAY: ['scan', 'inward scan', 'scan count', 'operator scan', 'scanned', 'scanning', 'barcode', 'qr scan', 'daily scan'],
    TOP_OPERATOR: ['best operator', 'top operator', 'operator rank', 'who scanned most', 'star worker', 'fastest worker', 'most productive', 'best staff'],
    OPERATOR_ACTIVITY: ['operator activity', 'worker activity', 'staff activity', 'activity logs', 'who is working', 'labor tracking', 'employee scan', 'who did what'],
    OUTWARD_TODAY: ['outward', 'dispatch', 'shipped', 'sent out', 'delivered', 'going out', 'export', 'loaded', 'moved out', 'truck dispatch'],
    INWARD_TODAY: ['inward', 'received', 'receipt', 'incoming', 'added', 'arrived', 'coming in', 'stock intake', 'warehouse entry'],
    ARTICLE_MOVEMENT: ['movement', 'article movement', 'fastest moving', 'highest moving', 'active article', 'bestseller', 'high demand', 'most popular', 'selling fast', 'highest sale', 'top sales'],
    DAILY_SUMMARY: ['summary', 'today summary', 'daily report', 'status', 'overview', 'whats happening', 'briefing', 'general report', 'quick update', 'wrap up', 'end of day', 'dashboard'],
    ANOMALY_CHECK: ['anomaly', 'suspicious', 'unusual', 'risk', 'flag', 'alert', 'odd', 'weird', 'error', 'mistake', 'discrepancy', 'mismatch', 'fraud'],
    VSTRAP_SUMMARY: ['v-strap', 'v strap', 'vstrap', 'strap count', 'strap balance', 'raw material', 'belt', 'upper part', 'rubber strap'],
    HELP: ['help', 'guide', 'command', 'what can you do', 'menu', 'options', 'features', 'how to use', 'chatbot instructions', 'commands list', 'support'],
    CURRENT_DATETIME: ['what time', 'current time', 'time now', 'what date', 'today date', 'ist time', 'mumbai time', 'date and time', 'indian time', 'clock'],
    SMALLTALK: ['hi', 'hello', 'hey', 'greetings', 'pookie', 'thanks', 'thank you', 'awesome', 'good job', 'smart', 'how are you', 'what is up', 'welcome'],
    PAYMENT_ALL_LIST: ['payment completed and pending', 'all payments', 'payment list', 'pending and completed', 'show me all payments']
  };

  const scores: Record<string, number> = {};
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (intent === 'INVENTORY_SUMMARY' && hasPaymentContext) continue;
    let score = 0;
    for (const kw of keywords) {
      if (t.includes(kw)) {
        score += kw.includes(' ') ? 3 : 1.5;
      }
    }
    if (score > 0) scores[intent] = score;
  }

  // Bonus for extracted entities matching corresponding intents
  if (entities.articleCode) {
    scores['ARTICLE_LOOKUP'] = (scores['ARTICLE_LOOKUP'] || 0) + 10;
  }
  if (entities.size) {
    scores['SIZE_LOOKUP'] = (scores['SIZE_LOOKUP'] || 0) + 8;
  }

  // Find the highest scoring intent
  let bestIntent = 'UNKNOWN';
  let maxScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  if (bestIntent !== 'UNKNOWN' && maxScore >= 1.5) {
    return {
      intent: bestIntent,
      confidence: 'medium',
      entities,
      needsClarification: false
    };
  }

  // 3. Fallback generic handlers for completely un-styled queries containing key terms
  if (
    !hasPaymentContext &&
    (t.includes('stock') || t.includes('inventory') || t.includes('details') || t.includes('ledger') || t.includes('balance'))
  ) {
    return { intent: 'INVENTORY_SUMMARY', confidence: 'medium', entities, needsClarification: false };
  }
  if (t.includes('order') || t.includes('po') || t.includes('purchase')) {
    return { intent: 'PROCUREMENT_SUMMARY', confidence: 'medium', entities, needsClarification: false };
  }
  if (t.includes('carton') || t.includes('package') || t.includes('box')) {
    return { intent: 'CARTONS_TODAY', confidence: 'medium', entities, needsClarification: false };
  }
  if (t.includes('scan') || t.includes('inward')) {
    return { intent: 'SCAN_TODAY', confidence: 'medium', entities, needsClarification: false };
  }
  if (t.includes('vendor') || t.includes('supplier')) {
    return { intent: 'VENDOR_SCORECARD', confidence: 'medium', entities, needsClarification: false };
  }

  // If absolutely nothing can be matched, default to UNKNOWN so it can be handled by the external LLM (Gemini)
  return {
    intent: 'UNKNOWN',
    confidence: 'low',
    entities,
    needsClarification: false
  };
}
