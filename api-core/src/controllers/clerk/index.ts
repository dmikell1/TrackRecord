/* eslint-disable @typescript-eslint/naming-convention */

import express, { Response } from 'express'
import { container } from 'tsyringe'

import { CoachSignupService } from '@packages/services/user/CoachSignupService'
import { UserService } from '@packages/services/user/UserService'
import { env } from '@packages/utils/validateEnvs'
import { ReportingService } from '@packages/services/logging/ReportingService'

export const clerkRouter = express.Router()

clerkRouter.post('/webhook/user-created', async (req, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const coachSignupService = container.resolve(CoachSignupService)
	const event = req.body
	reportingService.log({
		message: 'Clerk webhook received',
		headers: req.headers
	})

	if (req.headers['p-secret'] !== env.CLERK_P_SECRET) {
		return res.status(401).json({ ok: false })
	}

	const { data } = event

	const {
		first_name,
		profile_image_url,
		has_image,
		last_name,
		id,
		email_addresses,
		unsafe_metadata
	} = data

	const avatarUrl = has_image ? (profile_image_url ?? '') : ''

	const { timezoneName, termsAndConditions, userId, inviteToken } =
		unsafe_metadata || {}

	reportingService.log({
		message: 'Clerk webhook data',
		data: {
			id,
			first_name,
			last_name,
			email: email_addresses?.[0]?.email_address,
			profile_image_url,
			timezoneName,
			termsAndConditions,
			userId,
			hasInviteToken: !!inviteToken
		}
	})

	const email = email_addresses[0]?.email_address

	try {
		await coachSignupService.handleUserCreated({
			payload: {
				clerkId: id,
				firstName: first_name,
				lastName: last_name,
				email,
				avatarUrl,
				unsafeMetadata: {
					timezoneName,
					termsAndConditions,
					userId,
					inviteToken
				}
			}
		})

		return res.status(200).json({ ok: true })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		return res.status(500).json({ ok: false })
	}
})

clerkRouter.post('/webhook/user-updated', async (req, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const userService = container.resolve(UserService)

	const event = req.body
	reportingService.log({
		message: 'Clerk webhook received',
		headers: req.headers
	})

	if (req.headers['p-secret'] !== env.CLERK_P_SECRET) {
		return res.status(401).json({ ok: false })
	}

	const { data } = event
	const {
		first_name,
		profile_image_url,
		has_image,
		last_name,
		id,
		email_addresses
	} = data

	const email = email_addresses[0]?.email_address
	const avatarUrl = has_image ? (profile_image_url ?? '') : ''

	try {
		await userService.updateUser({
			filter: { clerkId: id },
			data: {
				email,
				avatar: avatarUrl,
				firstName: first_name,
				lastName: last_name
			}
		})

		return res.status(200).json({ ok: true })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		return res.status(500).json({ ok: false })
	}
})
