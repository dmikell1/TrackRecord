import { createClerkClient } from '@clerk/backend'
import { format } from 'date-fns'
import { inject, injectable, singleton } from 'tsyringe'

import { UserStatus } from '@packages/enums'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import SlackService from '@packages/services/communication/SlackService'
import { CompanyService } from '@packages/services/company/CompanyService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'
import type { UserInterface } from '@packages/types'
import { env } from '@packages/utils/validateEnvs'

export interface ClerkUserCreatedPayload {
	clerkId: string
	firstName?: string | null
	lastName?: string | null
	email?: string
	avatarUrl?: string
	unsafeMetadata?: {
		timezoneName?: string
		termsAndConditions?: boolean
		userId?: string
		inviteToken?: string
	}
}

const buildDefaultTeamName = ({
	firstName,
	lastName
}: {
	firstName?: string | null
	lastName?: string | null
}): string => {
	const name = [firstName, lastName]
		.filter(
			(part): part is string =>
				typeof part === 'string' && part.trim().length > 0
		)
		.map(part => part.trim())
		.join(' ')

	return name.length > 0 ? name : 'My Team'
}

@injectable()
@singleton()
@ReportErrors()
export class CoachSignupService {
	constructor(
		@inject(UserService) private userService: UserService,
		@inject(CompanyService) private companyService: CompanyService,
		@inject(AthleteInviteService)
		private athleteInviteService: AthleteInviteService,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async handleUserCreated({
		payload
	}: {
		payload: ClerkUserCreatedPayload
	}): Promise<void> {
		const {
			clerkId,
			firstName,
			lastName,
			email,
			avatarUrl = '',
			unsafeMetadata
		} = payload

		const count = await this.userService.countUsers({ filter: { clerkId } })
		if (count > 0) {
			return
		}

		const { timezoneName, termsAndConditions, userId, inviteToken } =
			unsafeMetadata ?? {}

		const companyName = buildDefaultTeamName({ firstName, lastName })

		if (userId) {
			const user = await this.userService.findUserOrFail({
				filter: { id: userId }
			})
			if (user.status !== UserStatus.Pending) {
				throw new Error(
					`user with id: ${userId} has already been activated`
				)
			}

			await this.userService.updateUser({
				filter: { id: userId },
				data: {
					clerkId,
					email,
					avatar: avatarUrl,
					firstName: firstName ?? '',
					lastName: lastName ?? '',
					status: UserStatus.Active
				}
			})
			return
		}

		if (inviteToken) {
			await this.athleteInviteService.ensureUserForInviteSignup({
				clerkId,
				profile: {
					firstName: firstName ?? '',
					lastName: lastName ?? '',
					email: email ?? '',
					avatar: avatarUrl,
					termsAndConditions
				}
			})
			return
		}

		if (!email) {
			throw new Error('Clerk account has no email address')
		}

		// Live vs test Clerk (or re-signup): same email may already exist under
		// a different clerkId. Relink instead of failing on unique email.
		const existingByEmail = await this.userService.findUser({
			filter: { email: email.toLowerCase() }
		})

		if (existingByEmail) {
			await this.userService.updateUser({
				filter: { id: existingByEmail.id },
				data: {
					clerkId,
					firstName: firstName ?? existingByEmail.firstName,
					lastName: lastName ?? existingByEmail.lastName,
					avatar: avatarUrl || existingByEmail.avatar,
					status: UserStatus.Active
				}
			})

			this.reportingService.log({
				message: `Linked existing user ${existingByEmail.id} to clerkId`
			})
			return
		}

		const user = await this.userService.createUser({
			userData: {
				firstName: firstName ?? '',
				lastName: lastName ?? '',
				email,
				avatar: avatarUrl,
				status: UserStatus.Active,
				termsAndConditions: termsAndConditions ?? true,
				clerkId
			}
		})

		this.reportingService.log({ message: `created user: ${user.id}` })

		const { company } = await this.companyService.createCompany({
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

		this.reportingService.log({ message: `created company: ${company.id}` })

		const createdAt = user.createdAt ?? new Date()
		const registerDate = format(
			createdAt instanceof Date ? createdAt : new Date(createdAt),
			'MM/d/yyyy'
		)

		const message = `New Sign Up: \n First Name: ${user.firstName} \n Last Name: ${user.lastName} \n Company: ${companyName}\n Email: ${user.email} \n Date Registered: ${registerDate}`

		this.reportingService.log({ message })
		await SlackService.sendSlackMessage({
			url: '',
			message
		})
	}

	public async provisionFromClerkIdIfMissing({
		clerkId
	}: {
		clerkId: string
	}): Promise<UserInterface | null> {
		const existing = await this.userService.findUser({
			filter: { clerkId },
			relations: {
				loadCompanies: true,
				loadTeams: true,
				loadRoles: true
			}
		})

		if (existing) {
			return existing
		}

		const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
		const clerkUser = await client.users.getUser(clerkId)
		const primaryEmail = clerkUser.emailAddresses.find(
			address => address.id === clerkUser.primaryEmailAddressId
		)
		const email =
			primaryEmail?.emailAddress ??
			clerkUser.emailAddresses[0]?.emailAddress

		await this.handleUserCreated({
			payload: {
				clerkId,
				firstName: clerkUser.firstName,
				lastName: clerkUser.lastName,
				email,
				avatarUrl: clerkUser.hasImage ? (clerkUser.imageUrl ?? '') : '',
				unsafeMetadata: clerkUser.unsafeMetadata as
					| ClerkUserCreatedPayload['unsafeMetadata']
					| undefined
			}
		})

		return this.userService.findUser({
			filter: { clerkId },
			relations: {
				loadCompanies: true,
				loadTeams: true,
				loadRoles: true
			}
		})
	}
}
