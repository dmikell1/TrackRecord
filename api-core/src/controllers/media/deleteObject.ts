import express, { Request, Response } from 'express'
import { container } from 'tsyringe'

import { MediaStorageService } from '@packages/services/media/MediaStorageService'
import { ReportingService } from '@packages/services/logging/ReportingService'

export const deleteObjectRouter = express.Router()

deleteObjectRouter.delete('/:key(*)', async (req: Request, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const mediaStorageService = container.resolve(MediaStorageService)

	const session = (req as unknown as { session: { userId?: string } }).session
	if (!session?.userId) {
		return res.status(401).json({ ok: false, error: 'Unauthorized' })
	}

	const { key } = req.params as { key: string }
	if (!key) {
		return res.status(400).json({ ok: false, error: 'Missing key' })
	}

	const userPrefix = `${session.userId}/`
	const allowedPrefixes = [`videos/${userPrefix}`, `thumbnails/${userPrefix}`]
	const isOwnedKey = allowedPrefixes.some((prefix) => key.startsWith(prefix))
	if (!isOwnedKey) {
		return res.status(403).json({ ok: false, error: 'Forbidden' })
	}

	try {
		await mediaStorageService.deleteObject({ key })
		return res.status(200).json({ ok: true })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		return res.status(500).json({ ok: false, error: 'Failed to delete object' })
	}
})
