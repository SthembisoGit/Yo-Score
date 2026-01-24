import { Request, Response } from 'express';
import { ReferenceDocsService } from '../services/referenceDocs.service';
import { authenticate, authorize } from '../middleware/auth.middleware';

const referenceDocsService = new ReferenceDocsService();

export class ReferenceDocsController {
  async getChallengeDocs(req: Request, res: Response) {
    try {
      const { challenge_id } = req.params;

      if (!challenge_id) {
        return res.status(400).json({
          success: false,
          message: 'Challenge ID is required'
        });
      }

      const docs = await referenceDocsService.getDocsForChallenge(challenge_id);

      return res.status(200).json({
        success: true,
        message: 'Reference docs retrieved successfully',
        data: docs
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve reference docs';
      
      return res.status(500).json({
        success: false,
        message,
        error: 'DOCS_FETCH_FAILED'
      });
    }
  }

  async createDoc(req: Request, res: Response) {
    try {
      console.log('=== CREATE DOC DEBUG ===');
      console.log('Request params:', req.params);
      console.log('Request body:', req.body);
      console.log('Body type:', typeof req.body);
      console.log('Body keys:', Object.keys(req.body || {}));
      console.log('Headers:', req.headers['content-type']);
      console.log('challenge_id from params:', req.params.challenge_id);
      console.log('title from body:', req.body?.title);
      console.log('content from body:', req.body?.content ? 'Present' : 'Missing');
      console.log('========================');

      const { challenge_id } = req.params;
      const { title, content } = req.body;

      console.log('After destructuring:');
      console.log('challenge_id:', challenge_id);
      console.log('title:', title);
      console.log('content:', content);

      if (!challenge_id || !title || !content) {
        console.log('Validation failed - missing:');
        console.log('challenge_id:', !challenge_id ? 'MISSING' : 'OK');
        console.log('title:', !title ? 'MISSING' : 'OK');
        console.log('content:', !content ? 'MISSING' : 'OK');
        return res.status(400).json({
          success: false,
          message: 'Challenge ID, title, and content are required'
        });
      }

      const doc = await referenceDocsService.createDoc(challenge_id, title, content);

      return res.status(201).json({
        success: true,
        message: 'Reference doc created successfully',
        data: doc
      });

    } catch (error) {
      console.error('Create doc error:', error);
      const message = error instanceof Error ? error.message : 'Failed to create reference doc';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'DOC_CREATION_FAILED'
      });
    }
  }
}