import { Request, Response } from 'express';
import { challengeTestsService } from '../services/challengeTests.service';

export class ChallengeTestsController {
  async list(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({ success: false, message: 'Challenge ID is required', error: 'VALIDATION_FAILED' });
      }
      const tests = await challengeTestsService.listTestCases(challenge_id);
      return res.status(200).json({ success: true, message: 'Tests retrieved', data: tests });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to list tests', error: 'REQUEST_FAILED' });
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({ success: false, message: 'Challenge ID is required', error: 'VALIDATION_FAILED' });
      }
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
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to upsert test', error: 'REQUEST_FAILED' });
    }
  }

  async remove(req: Request, res: Response) {
    try {
      const { challenge_id, test_id } = req.params;
      if (!challenge_id || !test_id) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID and test ID are required',
          error: 'VALIDATION_FAILED',
        });
      }
      await challengeTestsService.deleteTestCase(challenge_id, test_id);
      return res.status(200).json({
        success: true,
        message: 'Test deleted',
        data: { test_id },
      });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to delete test', error: 'REQUEST_FAILED' });
    }
  }

  async getBaseline(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({ success: false, message: 'Challenge ID is required', error: 'VALIDATION_FAILED' });
      }
      const language = ((req.query.language as string) || 'python').toLowerCase();
      if (!['python', 'javascript'].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'language must be javascript or python',
          error: 'VALIDATION_FAILED',
        });
      }
      const baseline = await challengeTestsService.getBaseline(challenge_id, language);
      return res.status(200).json({ success: true, message: 'Baseline retrieved', data: baseline });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to get baseline', error: 'REQUEST_FAILED' });
    }
  }

  async upsertBaseline(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;
      if (!challenge_id) {
        return res.status(400).json({ success: false, message: 'Challenge ID is required', error: 'VALIDATION_FAILED' });
      }
      const baseline = await challengeTestsService.upsertBaseline(challenge_id, req.body);
      return res.status(200).json({ success: true, message: 'Baseline updated', data: baseline });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to update baseline', error: 'REQUEST_FAILED' });
    }
  }
}
