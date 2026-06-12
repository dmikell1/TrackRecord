import crypto from 'crypto'
import express, { Request, Response } from 'express'
import { container } from 'tsyringe'

import { MediaStorageService } from '@packages/services/media/MediaStorageService'
import { ReportingService } from '@packages/services/logging/ReportingService'

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
}

export const presignRouter = express.Router()

presignRouter.post('/', async (req: Request, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const mediaStorageService = container.resolve(MediaStorageService)

	const session = (req as unknown as { session: { userId?: string } }).session
	if (!session?.userId) {
		return res.status(401).json({ ok: false, error: 'Unauthorized' })
	}

	const { contentType, folder = 'videos' } = req.body as { contentType?: string; folder?: string }

	if (!contentType || !ALLOWED_CONTENT_TYPES[contentType]) {
		return res.status(400).json({ ok: false, error: 'Unsupported content type' })
	}

	const ext = ALLOWED_CONTENT_TYPES[contentType]
	const key = `${folder}/${session.userId}/${crypto.randomUUID()}.${ext}`

	try {
		const result = await mediaStorageService.createPresignedUpload({ key, contentType })
		return res.status(200).json({ ok: true, ...result })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		return res.status(500).json({ ok: false, error: 'Failed to generate presigned URL' })
	}
})
