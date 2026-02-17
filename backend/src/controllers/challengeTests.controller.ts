import { Request, Response } from 'express';
import { challengeTestsService } from '../services/challengeTests.service';

export class ChallengeTestsController {
  async list(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      const tests = await challengeTestsService.listTestCases(challenge_id);
      return res.status(200).json({ success: true, message: 'Tests retrieved', data: tests });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: 'Failed to list tests', error: error.message });
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      const test = await challengeTestsService.upsertTestCase(
        challenge_id,
        test_id || null,
        req.body,
      );
      return res.status(test_id ? 200 : 201).json({
        success: true,
        message: test_id ? 'Test updated' : 'Test created',
        data: test,
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: 'Failed to upsert test', error: error.message });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      await challengeTestsService.deleteTestCase(challenge_id, test_id);
      return res.status(200).json({
        success: true,
        message: 'Test deleted',
        data: { test_id },
      });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: 'Failed to delete test', error: error.message });
    }
  }

  async getBaseline(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      const language = (req.query.language as string) || 'python';
      const baseline = await challengeTestsService.getBaseline(challenge_id, language);
      return res.status(200).json({ success: true, message: 'Baseline retrieved', data: baseline });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: 'Failed to get baseline', error: error.message });
    }
  }

  async upsertBaseline(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      const baseline = await challengeTestsService.upsertBaseline(challenge_id, req.body);
      return res.status(200).json({ success: true, message: 'Baseline updated', data: baseline });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: 'Failed to update baseline', error: error.message });
    }
  }
}
