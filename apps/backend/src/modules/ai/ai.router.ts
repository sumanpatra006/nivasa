import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  checkSafetyEscalation,
  COMPLAINT_URGENCY,
} from '@nivasa/shared';
import { complaintClassifier } from '../complaints/complaintClassifier.js';

export const aiRouter = Router();

aiRouter.use(authMiddleware);

aiRouter.post('/classify-complaint', async (req: Request, res: Response) => {
  const { title = '', description = '' } = req.body;

  // 1. Mandatory Deterministic Safety Escalation Rule (Overrides AI)
  const safety = checkSafetyEscalation(title, description);

  // 2. Classify via AI Provider / Deterministic Fallback
  const result = await complaintClassifier.classifyComplaint(title, description);

  let urgency = result.urgency;
  let confidence = result.confidence;
  let explanation = result.explanation;

  // Enforce safety override
  if (safety.isSafetyEscalation) {
    urgency = COMPLAINT_URGENCY.CRITICAL;
    confidence = 1.0;
    explanation = `Safety override triggered due to hazardous signals [${safety.matchedTerms.join(', ')}]. Urgency escalated to CRITICAL.`;
  }

  res.status(200).json({
    category: result.category,
    urgency,
    confidence,
    suggestedTeam: result.suggestedTeam,
    isSafetyEscalation: safety.isSafetyEscalation,
    matchedSafetyTerms: safety.matchedTerms,
    explanation,
    isAiFallback: result.isFallback,
  });
});
