import type { IncomingMessage } from 'http'

import type { NextFunction } from 'express'
import { Session } from 'express-session'
import { container } from 'tsyringe'

import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserInterface } from '@packages/types'

type SessionRequest = IncomingMessage & {
	session: S
}

interface S extends Session {
	userId: string
	user: UserInterface
}

export const authenticatedRoute = async (
	req: SessionRequest,
	_res: unknown,
	next: NextFunction
): Promise<void> => {
	const reportingService = container.resolve(ReportingService)
	try {
		if (req.session.userId) {
			next()
		}
	} catch (e) {
		reportingService.reportError({ error: e as Error })
	}
}
