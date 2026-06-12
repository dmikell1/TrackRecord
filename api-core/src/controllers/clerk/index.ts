/* eslint-disable @typescript-eslint/naming-convention */

import { UserService } from '@packages/services/user/UserService'
import { format } from 'date-fns'
import express, { Response } from 'express'
import { container } from 'tsyringe'

import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import { CompanyService } from '@packages/services/company/CompanyService'
import SlackService from '@packages/services/communication/SlackService'
import { UserStatus } from '@packages/enums'

import { env } from '@packages/utils/validateEnvs'
import { ReportingService } from '@packages/services/logging/ReportingService'

export const clerkRouter = express.Router()

clerkRouter.post('/webhook/user-created', async (req, res: Response) => {
	const reportingService = container.resolve(ReportingService)
	const userService = container.resolve(UserService)
	const companyService = container.resolve(CompanyService)
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

	const { timezoneName, termsAndConditions, userId, inviteToken } = unsafe_metadata || {}

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

	const companyName = `${first_name} ${last_name}`

	const count = await userService.countUsers({ filter: { clerkId: id } })

	if (count > 0) {
		return res.status(200).json({ ok: true })
	}

	const email = email_addresses[0]?.email_address

	try {
		if (userId) {
			const user = await userService.findUserOrFail({
				filter: { id: userId }
			})
			if (user.status !== UserStatus.Pending) {
				const error = new Error(
					`user with id: ${userId} has already been activated`
				)
				reportingService.reportError({ error })
				throw error
			}

			await userService.updateUser({
				filter: { id: userId },
				data: {
					clerkId: id,
					email,
					avatar: avatarUrl,
					firstName: first_name,
					lastName: last_name,
					status: UserStatus.Active
				}
			})
		} else if (inviteToken) {
			const athleteInviteService = container.resolve(AthleteInviteService)

			await athleteInviteService
				.completeAthleteInviteSignup({
					token: inviteToken as string,
					clerkId: id,
					profile: {
						firstName: first_name,
						lastName: last_name,
						email,
						avatar: avatarUrl,
						termsAndConditions
					}
				})
				.catch((e) => {
					reportingService.reportError({ error: e as Error })
				})
		} else {
			const user = await userService.createUser({
				userData: {
					firstName: first_name,
					lastName: last_name,
					email,
					avatar: avatarUrl,
					status: UserStatus.Active,
					termsAndConditions,
					clerkId: id
				}
			})

			reportingService.log({ message: `created user: ${user.id}` })
			const { company } = await companyService.createCompany({
				data: {
					ownerId: user.id,
					name: companyName,
					...(timezoneName !== undefined &&
						timezoneName !== '' && {
							settings: {
								timezoneName
							}
						})
				}
			})

			reportingService.log({ message: `created company: ${company.id}` })
			const createdAt = user.createdAt ?? new Date()
			const registerDate = format(
				createdAt instanceof Date ? createdAt : new Date(createdAt),
				'MM/d/yyyy'
			)

			const message = `New Sign Up: \n First Name: ${user.firstName} \n Last Name: ${user.lastName} \n Company: ${companyName}\n Email: ${user.email} \n Date Registered: ${registerDate}`

			reportingService.log({ message })
			await SlackService.sendSlackMessage({
				url: '',
				message
			})
		}

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
