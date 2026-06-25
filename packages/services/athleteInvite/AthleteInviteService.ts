import { createClerkClient } from '@clerk/backend'
import crypto from 'crypto'
import { addDays } from 'date-fns'
import { injectable, inject, singleton } from 'tsyringe'

import { UserStatus } from '@packages/enums'
import { AthleteInviteStatus, JoinInviteKind } from '@packages/enums/trackRecord'
import { NotificationType } from '@packages/enums/notifications'
import type { AthleteInviteFilter } from '@packages/repositories/athleteInvite/AthleteInviteRepository'
import { AthleteInviteRepository } from '@packages/repositories/athleteInvite/AthleteInviteRepository'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { buildAthleteInviteEmail } from '@packages/services/email/athleteInviteEmailTemplate'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import queueService from '@packages/services/queue/QueueService'
import { UserService } from '@packages/services/user/UserService'
import { buildAthleteInviteUrl } from '@packages/utils/buildInviteUrl'
import { env } from '@packages/utils/validateEnvs'
import type { AthleteInviteInterface } from '@packages/types/athleteInvite'
import type { AthleteInterface } from '@packages/types/athlete'
import type { JoinInfoInterface } from '@packages/types/join'
import type { TeamInterface } from '@packages/types/team'

const DEFAULT_ATHLETE_COLOR = '#3B82F6'
const INVITE_EXPIRY_DAYS = 7

interface AthleteSignupProfile {
	firstName: string
	lastName: string
	email: string
	avatar: string
	termsAndConditions?: boolean
}

@injectable()
@singleton()
@ReportErrors()
export class AthleteInviteService {
	constructor(
		@inject(AthleteInviteRepository) private athleteInviteRepository: AthleteInviteRepository,
		@inject(AthleteRepository) private athleteRepository: AthleteRepository,
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(UserService) private userService: UserService,
		@inject(TrackRecordNotificationRepository) private notificationRepository: TrackRecordNotificationRepository,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async createAthleteInvite({ teamId, email }: {
		teamId: string
		email: string
	}): Promise<{ invite: AthleteInviteInterface; emailSent: boolean }> {
		const invite = await this.createAthleteInviteRecord({ teamId, email })
		const emailSent = await this.tryQueueAthleteInviteEmail({ invite })
		return { invite, emailSent }
	}

	public async getAthleteInviteLink({
		teamId,
		athleteId
	}: {
		teamId: string
		athleteId: string
	}): Promise<string> {
		const invite = await this.getOrCreatePendingInviteForAthlete({ teamId, athleteId })
		return buildAthleteInviteUrl({ token: invite.token })
	}

	public async findAthleteInvite({ filter }: { filter: AthleteInviteFilter }): Promise<AthleteInviteInterface | null> {
		return this.athleteInviteRepository.findOne({ filter })
	}

	public async sendAthleteInviteEmail({
		teamId,
		inviteId
	}: {
		teamId: string
		inviteId: string
	}): Promise<boolean> {
		const invite = await this.getSendableInvite({ teamId, inviteId })
		await this.queueAthleteInviteEmail({ invite })
		return true
	}

	public async resendAthleteInvite({
		teamId,
		athleteId
	}: {
		teamId: string
		athleteId: string
	}): Promise<AthleteInviteInterface> {
		const athlete = await this.athleteRepository.findOne({
			filter: { id: athleteId, teamId }
		})
		if (!athlete) {
			throw new Error('Athlete not found')
		}
		if (athlete.userId) {
			throw new Error('Athlete is already connected to the app')
		}

		let invite = await this.athleteInviteRepository.findOne({
			filter: {
				email: athlete.email,
				teamId,
				status: AthleteInviteStatus.Pending
			}
		})

		if (!invite || invite.expiresAt < new Date()) {
			invite = await this.createAthleteInviteRecord({
				teamId,
				email: athlete.email
			})
		}

		await this.queueAthleteInviteEmail({ invite })
		return invite
	}

	public async resolveJoinInfo({ token }: { token: string }): Promise<JoinInfoInterface | null> {
		const invite = await this.findAthleteInvite({ filter: { token } })
		if (invite) {
			const team = await this.teamRepository.findOne({ filter: { id: invite.teamId } })
			const athlete = await this.athleteRepository.findOne({
				filter: { email: invite.email, teamId: invite.teamId }
			})

			return {
				kind: JoinInviteKind.Athlete,
				teamId: invite.teamId,
				teamName: team?.name ?? '',
				email: invite.email,
				firstName: athlete?.firstName ?? null,
				lastName: athlete?.lastName ?? null,
				status: invite.status as AthleteInviteStatus
			}
		}

		const team = await this.teamRepository.findByInviteToken({ token })
		if (!team) {
			return null
		}

		return {
			kind: JoinInviteKind.Team,
			teamId: team.id,
			teamName: team.name,
			email: null,
			status: null
		}
	}

	public async acceptJoin({ token, userId }: {
		token: string
		userId: string
	}): Promise<AthleteInterface> {
		const team = await this.teamRepository.findByInviteToken({ token })
		if (team) {
			return this.acceptTeamInvite({ team, userId })
		}

		return this.acceptAthleteInvite({ token, userId })
	}

	public async completeAthleteInviteSignup({
		token,
		clerkId,
		profile
	}: {
		token: string
		clerkId: string
		profile?: AthleteSignupProfile
	}): Promise<AthleteInterface> {
		const userId = await this.ensureUserForClerk({ clerkId, profile })
		const team = await this.teamRepository.findByInviteToken({ token })

		if (team) {
			return this.acceptTeamInvite({ team, userId })
		}

		const invite = await this.findAthleteInvite({ filter: { token } })
		if (!invite) {
			throw new Error('Invalid or expired invite token')
		}

		if (invite.status === AthleteInviteStatus.Accepted) {
			return this.resolveAcceptedAthleteInvite({ invite, userId })
		}

		if (invite.status === AthleteInviteStatus.Expired) {
			throw new Error('Invite has expired')
		}

		return this.acceptAthleteInvite({ token, userId })
	}

	public async acceptAthleteInvite({ token, userId }: {
		token: string
		userId: string
	}): Promise<AthleteInterface> {
		const invite = await this.athleteInviteRepository.findOne({
			filter: { token, status: AthleteInviteStatus.Pending }
		})
		if (!invite) {
			const acceptedInvite = await this.athleteInviteRepository.findOne({
				filter: { token, status: AthleteInviteStatus.Accepted }
			})
			if (acceptedInvite) {
				return this.resolveAcceptedAthleteInvite({
					invite: acceptedInvite,
					userId
				})
			}

			throw new Error('Invalid or expired invite token')
		}
		if (invite.expiresAt < new Date()) {
			await this.athleteInviteRepository.update({
				filter: { id: invite.id },
				data: { status: AthleteInviteStatus.Expired }
			})
			throw new Error('Invite has expired')
		}

		await this.assertUserMatchesInviteEmail({ userId, inviteEmail: invite.email })

		const athlete = await this.athleteRepository.findOne({
			filter: { email: invite.email, teamId: invite.teamId }
		})
		if (!athlete) {
			throw new Error('Athlete record not found for this invite')
		}

		await this.athleteRepository.linkUser({ id: athlete.id, userId })

		await this.teamRepository.addTeamUser({ teamId: invite.teamId, userId })

		await this.athleteInviteRepository.update({
			filter: { id: invite.id },
			data: { status: AthleteInviteStatus.Accepted, acceptedByUserId: userId }
		})

		const team = await this.teamRepository.findOne({ filter: { id: invite.teamId } })
		await this.notifyCoachOfJoin({
			team,
			teamId: invite.teamId,
			athlete,
			inviteId: invite.id
		})

		return { ...athlete, userId }
	}

	private async ensureUserForClerk({
		clerkId,
		profile
	}: {
		clerkId: string
		profile?: AthleteSignupProfile
	}): Promise<string> {
		const existing = await this.userRepository.findOne({ filter: { clerkId } })
		if (existing) {
			return existing.id
		}

		const resolvedProfile =
			profile ?? (await this.fetchClerkProfile({ clerkId }))

		const user = await this.userService.createUser({
			userData: {
				firstName: resolvedProfile.firstName,
				lastName: resolvedProfile.lastName,
				email: resolvedProfile.email,
				avatar: resolvedProfile.avatar,
				status: UserStatus.Active,
				termsAndConditions: resolvedProfile.termsAndConditions ?? true,
				clerkId
			}
		})

		return user.id
	}

	private async assertUserMatchesInviteEmail({
		userId,
		inviteEmail
	}: {
		userId: string
		inviteEmail: string
	}): Promise<void> {
		const user = await this.userRepository.findOneOrFail({ filter: { id: userId } })

		if (user.email.toLowerCase() !== inviteEmail.toLowerCase()) {
			throw new Error(
				'This invite was sent to a different email address. Sign out and use the invited account.'
			)
		}
	}

	private async resolveAcceptedAthleteInvite({
		invite,
		userId
	}: {
		invite: AthleteInviteInterface
		userId: string
	}): Promise<AthleteInterface> {
		await this.assertUserMatchesInviteEmail({ userId, inviteEmail: invite.email })

		const athlete = await this.athleteRepository.findOne({
			filter: { email: invite.email, teamId: invite.teamId }
		})
		if (!athlete) {
			throw new Error('Athlete record not found for this invite')
		}

		if (athlete.userId && athlete.userId !== userId) {
			throw new Error('This invite was already used by another account')
		}

		const linkedAthlete = athlete.userId
			? athlete
			: await this.athleteRepository.linkUser({ id: athlete.id, userId })

		if (!linkedAthlete) {
			throw new Error('Failed to link athlete account')
		}

		await this.teamRepository.addTeamUser({ teamId: invite.teamId, userId })

		return { ...linkedAthlete, userId }
	}

	private async fetchClerkProfile({
		clerkId
	}: {
		clerkId: string
	}): Promise<AthleteSignupProfile> {
		const client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
		const clerkUser = await client.users.getUser(clerkId)
		const email = clerkUser.emailAddresses[0]?.emailAddress

		if (!email) {
			throw new Error('Clerk account has no email address')
		}

		return {
			firstName: clerkUser.firstName ?? '',
			lastName: clerkUser.lastName ?? '',
			email,
			avatar: clerkUser.hasImage ? (clerkUser.imageUrl ?? '') : '',
			termsAndConditions: true
		}
	}

	private async acceptTeamInvite({
		team,
		userId
	}: {
		team: TeamInterface
		userId: string
	}): Promise<AthleteInterface> {
		const user = await this.userRepository.findOneOrFail({ filter: { id: userId } })
		const email = user.email.toLowerCase()

		const existingByUser = await this.athleteRepository.findOne({
			filter: { teamId: team.id, userId }
		})
		if (existingByUser) {
			await this.teamRepository.addTeamUser({ teamId: team.id, userId })
			return existingByUser
		}

		const existingByEmail = await this.athleteRepository.findOne({
			filter: { teamId: team.id, email }
		})

		if (existingByEmail) {
			if (existingByEmail.userId && existingByEmail.userId !== userId) {
				throw new Error('This email is already linked to another account on this team')
			}

			const linked = await this.athleteRepository.linkUser({
				id: existingByEmail.id,
				userId
			})
			if (!linked) {
				throw new Error('Failed to link athlete account')
			}

			await this.teamRepository.addTeamUser({ teamId: team.id, userId })
			await this.notifyCoachOfJoin({
				team,
				teamId: team.id,
				athlete: linked
			})

			return linked
		}

		const athlete = await this.athleteRepository.create({
			data: {
				teamId: team.id,
				companyId: team.companyId,
				firstName: user.firstName,
				lastName: user.lastName,
				email,
				color: DEFAULT_ATHLETE_COLOR,
				userId
			}
		})

		await this.teamRepository.addTeamUser({ teamId: team.id, userId })
		await this.notifyCoachOfJoin({
			team,
			teamId: team.id,
			athlete
		})

		return athlete
	}

	private async createAthleteInviteRecord({
		teamId,
		email
	}: {
		teamId: string
		email: string
	}): Promise<AthleteInviteInterface> {
		const token = crypto.randomUUID()
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS)
		return this.athleteInviteRepository.create({
			data: { teamId, email, token, expiresAt }
		})
	}

	private async getOrCreatePendingInviteForAthlete({
		teamId,
		athleteId
	}: {
		teamId: string
		athleteId: string
	}): Promise<AthleteInviteInterface> {
		const athlete = await this.athleteRepository.findOne({
			filter: { id: athleteId, teamId }
		})
		if (!athlete) {
			throw new Error('Athlete not found')
		}
		if (athlete.userId) {
			throw new Error('Athlete is already connected to the app')
		}

		let invite = await this.athleteInviteRepository.findOne({
			filter: {
				email: athlete.email,
				teamId,
				status: AthleteInviteStatus.Pending
			}
		})

		if (!invite || invite.expiresAt < new Date()) {
			invite = await this.createAthleteInviteRecord({
				teamId,
				email: athlete.email
			})
		}

		return invite
	}

	private async getSendableInvite({
		teamId,
		inviteId
	}: {
		teamId: string
		inviteId: string
	}): Promise<AthleteInviteInterface> {
		const invite = await this.athleteInviteRepository.findOne({
			filter: { id: inviteId, teamId, status: AthleteInviteStatus.Pending }
		})
		if (!invite) {
			throw new Error('Invite not found or already used')
		}
		if (invite.expiresAt < new Date()) {
			await this.athleteInviteRepository.update({
				filter: { id: invite.id },
				data: { status: AthleteInviteStatus.Expired }
			})
			throw new Error('Invite has expired')
		}

		return invite
	}

	private async tryQueueAthleteInviteEmail({
		invite
	}: {
		invite: AthleteInviteInterface
	}): Promise<boolean> {
		try {
			await this.queueAthleteInviteEmail({ invite })
			return true
		} catch (error) {
			this.reportingService.error('Failed to send athlete invite email', {
				error,
				inviteId: invite.id,
				email: invite.email,
				teamId: invite.teamId
			})
			return false
		}
	}

	private async queueAthleteInviteEmail({
		invite
	}: {
		invite: AthleteInviteInterface
	}): Promise<void> {
		const team = await this.teamRepository.findOne({ filter: { id: invite.teamId } })
		if (!team) {
			throw new Error('Team not found for invite')
		}

		const athlete = await this.athleteRepository.findOne({
			filter: { email: invite.email, teamId: invite.teamId }
		})

		const coach = team.ownerId
			? await this.userRepository.findOne({ filter: { id: team.ownerId } })
			: null

		const coachName = coach
			? `${coach.firstName} ${coach.lastName}`.trim() || 'Your coach'
			: 'Your coach'

		const inviteUrl = buildAthleteInviteUrl({ token: invite.token })
		const { subject, text, html } = buildAthleteInviteEmail({
			athleteFirstName: athlete?.firstName ?? '',
			teamName: team.name,
			coachName,
			inviteUrl,
			expiresInDays: INVITE_EXPIRY_DAYS
		})

		await queueService.scheduleSendEmail({
			to: invite.email,
			subject,
			text,
			html,
			...(coach?.email !== undefined && { replyTo: coach.email }),
			jobId: `athlete-invite-${invite.id}-${Date.now()}`
		})
	}

	private async notifyCoachOfJoin({
		team,
		teamId,
		athlete,
		inviteId
	}: {
		team: TeamInterface | null
		teamId: string
		athlete: AthleteInterface
		inviteId?: string
	}): Promise<void> {
		const coachUserId = team?.ownerId
		if (!coachUserId) {
			return
		}

		await this.notificationRepository.create({
			data: {
				userId: coachUserId,
				teamId,
				type: NotificationType.Join,
				text: `${athlete.firstName} ${athlete.lastName} joined your team.`,
				payload: {
					athleteId: athlete.id,
					...(inviteId !== undefined && { inviteId })
				}
			}
		}).catch((e) => {
			this.reportingService.reportError({ error: e as Error })
		})
	}
}
