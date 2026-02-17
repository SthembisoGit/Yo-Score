import { Request, Response } from 'express';
import { ReferenceDocsService } from '../services/referenceDocs.service';
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
      const { challenge_id } = req.params;
      const { title, content } = req.body;

      if (!challenge_id || !title || !content) {
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
      const message = error instanceof Error ? error.message : 'Failed to create reference doc';
      
      return res.status(400).json({
        success: false,
        message,
        error: 'DOC_CREATION_FAILED'
      });
    }
  }
}
