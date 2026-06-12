import type { IncomingMessage } from 'http'

import { verifyToken } from '@clerk/backend'
import type { NextFunction } from 'express'
import { Session } from 'express-session'
import { container } from 'tsyringe'

import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'
import { UserInterface } from '@packages/types'
import { env } from '@packages/utils/validateEnvs'

type SessionRequest = IncomingMessage & {
	session: S
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

const decodeJwtPayload = ({
	token
}: {
	token: string
}): { iss?: string; azp?: string; sub?: string } | null => {
	const parts = token.split('.')
	if (parts.length !== 3) {
		return null
	}

	try {
		const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
		const padded = base64.padEnd(
			base64.length + ((4 - (base64.length % 4)) % 4),
			'='
		)
		const json = Buffer.from(padded, 'base64').toString('utf8')
		return JSON.parse(json) as { iss?: string; azp?: string; sub?: string }
	} catch {
		return null
	}
}

export const setUserIdFromToken = async (
	req: SessionRequest,
	_res: unknown,
	next: NextFunction
): Promise<void> => {
	const userService = container.resolve(UserService)
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

	const headerIss = readHeader({ req, name: 'iss' })
	const headerAzp = readHeader({ req, name: 'azp' })
	const tokenPayload = decodeJwtPayload({ token })
	const iss = headerIss ?? tokenPayload?.iss
	const azp = headerAzp ?? tokenPayload?.azp

	try {
		const verifyOptions: {
			secretKey: string
			authorizedParties?: string[]
		} = {
			secretKey: env.CLERK_SECRET_KEY
		}

		if (azp) {
			verifyOptions.authorizedParties = [azp]
		}

		const payload = await verifyToken(token, verifyOptions)

		const { sub, email_verified: emailVerified } = payload

		if (sub) {
			req.session.clerkId = sub
		}

		const user = await userService.findUser({
			filter: { clerkId: sub },
			relations: {
				loadCompanies: true,
				loadTeams: true,
				loadRoles: true
			}
		})

		if (user) {
			req.session.userId = user.id
			req.session.user = user
			req.session.emailVerified = emailVerified === true
		}
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		req.session.userId = ''
	}

	next()
}
