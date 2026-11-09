import {
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  ComplaintCategory,
  ComplaintUrgency,
} from '@nivasa/shared';

export interface ClassificationResult {
  category: ComplaintCategory;
  urgency: ComplaintUrgency;
  confidence: number;
  suggestedTeam: string;
  explanation: string;
  isFallback: boolean;
}

export interface ComplaintClassifier {
  classifyComplaint(title: string, description: string): Promise<ClassificationResult>;
}

/**
 * Deterministic fallback rule-based classifier.
 * Strictly avoids faking AI output. When AI provider is absent or fails,
 * this executes explicit keyword heuristic scoring and marks `isFallback: true`.
 */
export function classifyDeterministic(title: string, description: string): ClassificationResult {
  const text = `${title} ${description}`.toLowerCase();

  // Category heuristics with suggested operational dispatch teams
  let category: ComplaintCategory = COMPLAINT_CATEGORY.OTHER;
  let suggestedTeam = 'General Township Help Desk';
  let matchedKeywords: string[] = [];

  const plumbingKeywords = ['water', 'leak', 'leaking', 'drip', 'pipe', 'tap', 'drain', 'flush', 'sink', 'washbasin', 'sewage', 'seepage', 'cistern', 'faucet'];
  const electricalKeywords = ['power', 'electric', 'short circuit', 'spark', 'light', 'switch', 'mcb', 'fuse', 'trip', 'voltage', 'bulb', 'geyser', 'wiring', 'socket'];
  const liftKeywords = ['lift', 'elevator', 'hoist', 'door stuck', 'lift button'];
  const securityKeywords = ['guard', 'gate', 'parking', 'intruder', 'barrier', 'theft', 'noise', 'trespass', 'unauthorized'];
  const cleaningKeywords = ['clean', 'garbage', 'dust', 'trash', 'waste', 'dirty', 'pest', 'cockroach', 'rodent', 'sweep', 'stench', 'smell', 'litter'];
  const clubhouseKeywords = ['gym', 'pool', 'swimming', 'badminton', 'tennis', 'clubhouse', 'court'];
  const commonAreaKeywords = ['corridor', 'lobby', 'terrace', 'garden', 'lawn', 'staircase', 'pathway', 'streetlight'];

  const matchCount = (keywords: string[]) => {
    const hits = keywords.filter((k) => text.includes(k));
    return hits;
  };

  const plumbingHits = matchCount(plumbingKeywords);
  const electricalHits = matchCount(electricalKeywords);
  const liftHits = matchCount(liftKeywords);
  const securityHits = matchCount(securityKeywords);
  const cleaningHits = matchCount(cleaningKeywords);
  const clubhouseHits = matchCount(clubhouseKeywords);
  const commonAreaHits = matchCount(commonAreaKeywords);

  const scores: Array<{ cat: ComplaintCategory; team: string; hits: string[] }> = [
    { cat: COMPLAINT_CATEGORY.PLUMBING, team: 'Plumbing Duty Team (Santosh Shinde)', hits: plumbingHits },
    { cat: COMPLAINT_CATEGORY.ELECTRICAL, team: 'Electrical Duty Team (Mahesh Jadhav)', hits: electricalHits },
    { cat: COMPLAINT_CATEGORY.LIFT, team: 'Lift Emergency Tech (OTIS)', hits: liftHits },
    { cat: COMPLAINT_CATEGORY.SECURITY, team: 'Township Security Office (Gate 1)', hits: securityHits },
    { cat: COMPLAINT_CATEGORY.CLEANING, team: 'Housekeeping Supervisor (Sunita Patil)', hits: cleaningHits },
    { cat: COMPLAINT_CATEGORY.CLUBHOUSE, team: 'Clubhouse Facility Desk', hits: clubhouseHits },
    { cat: COMPLAINT_CATEGORY.COMMON_AREA, team: 'Civil & Grounds Maintenance Team', hits: commonAreaHits },
  ];

  scores.sort((a, b) => b.hits.length - a.hits.length);

  if (scores[0].hits.length > 0) {
    category = scores[0].cat;
    suggestedTeam = scores[0].team;
    matchedKeywords = scores[0].hits;
  }

  // Urgency heuristics
  let urgency: ComplaintUrgency = COMPLAINT_URGENCY.NORMAL;
  const highKeywords = ['flooding', 'overflow', 'blackout', 'smoke', 'urgent', 'sparks', 'stuck', 'emergency'];
  const lowKeywords = ['aesthetic', 'minor', 'scratch', 'loose handle', 'suggestion'];

  if (highKeywords.some((k) => text.includes(k))) {
    urgency = COMPLAINT_URGENCY.HIGH;
  } else if (lowKeywords.some((k) => text.includes(k))) {
    urgency = COMPLAINT_URGENCY.LOW;
  }

  const confidence = matchedKeywords.length >= 2 ? 0.88 : matchedKeywords.length === 1 ? 0.75 : 0.40;

  return {
    category,
    urgency,
    confidence,
    suggestedTeam,
    explanation:
      matchedKeywords.length > 0
        ? `Deterministic rule-based classification matched keywords: [${matchedKeywords.join(', ')}].`
        : 'Default fallback category applied due to lack of distinct domain keywords.',
    isFallback: true,
  };
}

/**
 * Complaint Classification Service with AI Adapter and Deterministic Fallback.
 * If AI provider (e.g. GEMINI_API_KEY) is configured and reachable, queries it.
 * Otherwise, cleanly falls back to deterministic rule set with `isFallback: true`.
 */
export class DefaultComplaintClassifier implements ComplaintClassifier {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_KEY;
  }

  public async classifyComplaint(title: string, description: string): Promise<ClassificationResult> {
    // If no AI key configured, use deterministic fallback directly without simulated delay
    if (!this.apiKey) {
      return classifyDeterministic(title, description);
    }

    try {
      // Configured remote AI adapter attempt
      // (If network or quota failure occurs, catch block seamlessly engages fallback)
      const prompt = `Classify this residential society complaint:
Title: "${title}"
Description: "${description}"
Respond with JSON matching: { "category": "PLUMBING"|"ELECTRICAL"|"LIFT"|"SECURITY"|"CLEANING"|"COMMON_AREA"|"CLUBHOUSE"|"OTHER", "urgency": "LOW"|"NORMAL"|"HIGH"|"CRITICAL", "confidence": number, "suggestedTeam": string, "explanation": string }`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) {
        throw new Error(`AI Provider HTTP Error: ${response.status}`);
      }

      const json = await response.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty AI response');

      const parsed = JSON.parse(rawText);
      // Validate schema values
      const validCategory = Object.values(COMPLAINT_CATEGORY).includes(parsed.category)
        ? parsed.category
        : COMPLAINT_CATEGORY.OTHER;
      const validUrgency = Object.values(COMPLAINT_URGENCY).includes(parsed.urgency)
        ? parsed.urgency
        : COMPLAINT_URGENCY.NORMAL;

      return {
        category: validCategory,
        urgency: validUrgency,
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.85,
        suggestedTeam: parsed.suggestedTeam || 'General Township Help Desk',
        explanation: parsed.explanation || 'AI classification generated based on complaint semantic context.',
        isFallback: false,
      };
    } catch {
      // Deterministic fallback on any provider error / timeout
      const fallback = classifyDeterministic(title, description);
      fallback.explanation += ' (AI provider unreachable, deterministic fallback safely engaged)';
      return fallback;
    }
  }
}

export const complaintClassifier = new DefaultComplaintClassifier();
