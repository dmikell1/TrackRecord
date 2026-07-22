import type { IncomingMessage } from 'http'

import { verifyToken } from '@clerk/backend'
import type { NextFunction } from 'express'
import { Session } from 'express-session'
import { container } from 'tsyringe'

import { ReportingService } from '@packages/services/logging/ReportingService'
import { CoachSignupService } from '@packages/services/user/CoachSignupService'
import { UserService } from '@packages/services/user/UserService'
import { UserInterface } from '@packages/types'
import { env } from '@packages/utils/validateEnvs'

type SessionRequest = IncomingMessage & {
	session: S
	authClerkId?: string
	authUserId?: string
}

interface S extends Session {
	userId: string
	user: UserInterface
	clerkId?: string
	emailVerified?: boolean
}

const readHeader = ({
	req,
	name
}: {
	req: IncomingMessage
	name: string
}): string | undefined => {
	const raw = req.headers[name.toLowerCase()]
	if (raw === undefined) {
		return undefined
	}
	return Array.isArray(raw) ? raw[0] : raw
}

export const setUserIdFromToken = async (
	req: SessionRequest,
	_res: unknown,
	next: NextFunction
): Promise<void> => {
	const userService = container.resolve(UserService)
	const coachSignupService = container.resolve(CoachSignupService)
	const reportingService = container.resolve(ReportingService)
	const authorization = readHeader({ req, name: 'authorization' })

	if (!authorization) {
		if (req.session.userId && !req.session.user) {
			const user = await userService.findUser({
				filter: { id: req.session.userId },
				relations: {
					loadCompanies: true,
					loadTeams: true,
					loadRoles: true
				}
			})
			if (user) {
				req.session.user = user
			}
		}
		next()
		return
	}

	const [, token] = authorization.split(' ')

	if (!token) {
		next()
		return
	}

	try {
		// Do not pass authorizedParties from the token's own azp — that is redundant
		// and can fail for native clients when azp is missing or header-mismatched.
		const payload = await verifyToken(token, {
			secretKey: env.CLERK_SECRET_KEY
		})

		const { sub, email_verified: emailVerified } = payload

		if (sub) {
			// Prefer req-level fields: express-session may not reliably expose
			// custom properties to graphql-shield on the same request.
			req.authClerkId = sub
			req.session.clerkId = sub
		}

		let user = await userService.findUser({
			filter: { clerkId: sub },
			relations: {
				loadCompanies: true,
				loadTeams: true,
				loadRoles: true
			}
		})

		if (!user && sub) {
			try {
				user = await coachSignupService.provisionFromClerkIdIfMissing({
					clerkId: sub
				})
			} catch (provisionError) {
				reportingService.reportError({
					error: provisionError as Error
				})
			}
		}

		if (user) {
			req.authUserId = user.id
			req.session.userId = user.id
			req.session.user = user
			req.session.emailVerified = emailVerified === true
		}
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		req.authClerkId = undefined
		req.authUserId = undefined
		req.session.userId = ''
		req.session.clerkId = undefined
	}

	next()
}
