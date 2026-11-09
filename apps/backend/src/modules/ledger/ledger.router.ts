import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { flatAccessMiddleware } from '../../middleware/flatAccess.middleware.js';
import { PaymentRepository } from '../../repositories/payment.repository.js';

export const ledgerRouter = Router();

ledgerRouter.use(authMiddleware);

ledgerRouter.get('/:flatId', flatAccessMiddleware, async (req: Request, res: Response) => {
  const flatId = Array.isArray(req.params.flatId) ? req.params.flatId[0] : req.params.flatId;
  const ledger = await PaymentRepository.getLedger(flatId);

  res.status(200).json({
    flatId,
    closingBalancePaise: ledger.closingBalancePaise,
    entries: ledger.entries,
  });
});
