import { createClerkClient } from '@clerk/backend'
import crypto from 'crypto'
import { addDays } from 'date-fns'
import { inject, injectable, singleton } from 'tsyringe'

import { UserRoles, UserStatus } from '@packages/enums'
import {
	AthleteInviteStatus,
	JoinInviteKind,
	RecorderInviteStatus,
	TeamRecorderStatus
} from '@packages/enums/trackRecord'
import { NotificationType } from '@packages/enums/notifications'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import type { RecorderInviteFilter } from '@packages/repositories/recorderInvite/RecorderInviteRepository'
import { RecorderInviteRepository } from '@packages/repositories/recorderInvite/RecorderInviteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { UserRoleRepository } from '@packages/repositories/userRole/UserRoleRepository'
import { EntitlementService } from '@packages/services/billing/EntitlementService'
import { buildRecorderInviteEmail } from '@packages/services/email/recorderInviteEmailTemplate'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import queueService from '@packages/services/queue/QueueService'
import { UserService } from '@packages/services/user/UserService'
import type { JoinInfoInterface } from '@packages/types/join'
import type { RecorderInviteInterface } from '@packages/types/recorderInvite'
import type { TeamInterface } from '@packages/types/team'
import type { TeamRecorderEntryInterface } from '@packages/types/teamRecorder'
import { buildRecorderInviteUrl } from '@packages/utils/buildInviteUrl'
import { env } from '@packages/utils/validateEnvs'

const INVITE_EXPIRY_DAYS = 7

interface RecorderSignupProfile {
	firstName: string
	lastName: string
	email: string
	avatar: string
	termsAndConditions?: boolean
}

@injectable()
@singleton()
@ReportErrors()
export class RecorderInviteService {
	constructor(
		@inject(RecorderInviteRepository)
		private recorderInviteRepository: RecorderInviteRepository,
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(CompanyRepository) private companyRepository: CompanyRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(UserRoleRepository) private userRoleRepository: UserRoleRepository,
		@inject(UserService) private userService: UserService,
		@inject(EntitlementService) private entitlementService: EntitlementService,
		@inject(TrackRecordNotificationRepository)
		private notificationRepository: TrackRecordNotificationRepository,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async createRecorderInvite({
		teamId,
		email
	}: {
		teamId: string
		email: string
	}): Promise<{ invite: RecorderInviteInterface; emailSent: boolean }> {
		const team = await this.teamRepository.findOneOrFail({
			filter: { id: teamId }
		})

		const normalizedEmail = email.trim().toLowerCase()
		if (!normalizedEmail.includes('@')) {
			throw new Error('A valid email address is required')
		}

		const existingPending = await this.recorderInviteRepository.findOne({
			filter: {
				teamId,
				email: normalizedEmail,
				status: RecorderInviteStatus.Pending
			}
		})
		if (existingPending && existingPending.expiresAt >= new Date()) {
			const emailSent = await this.tryQueueRecorderInviteEmail({
				invite: existingPending
			})
			return { invite: existingPending, emailSent }
		}

		await this.entitlementService.assertCanAddRecorder({
			companyId: team.companyId
		})

		const invite = await this.createRecorderInviteRecord({
			teamId,
			email: normalizedEmail
		})
		const emailSent = await this.tryQueueRecorderInviteEmail({ invite })
		return { invite, emailSent }
	}

	public async listTeamRecorders({
		teamId
	}: {
		teamId: string
	}): Promise<TeamRecorderEntryInterface[]> {
		const team = await this.teamRepository.findOneOrFail({
			filter: { id: teamId }
		})

		const pendingInvites = await this.recorderInviteRepository.find({
			filter: {
				teamId,
				status: RecorderInviteStatus.Pending
			}
		})

		const recorderRoles = await this.userRoleRepository.find({
			filter: {
				companyId: team.companyId,
				role: UserRoles.Recorder
			}
		})
		const teamUserIds = new Set(
			await this.teamRepository.findUserIdsByTeamId({ teamId })
		)
		const activeUserIds = recorderRoles
			.map((role) => role.userId)
			.filter((userId) => teamUserIds.has(userId))

		const activeUsers = await this.userRepository.findByIds({
			ids: activeUserIds
		})
		const activeEntries: TeamRecorderEntryInterface[] = activeUsers.map(
			(activeUser) => {
				const displayName =
					`${activeUser.firstName} ${activeUser.lastName}`.trim() ||
					activeUser.email
				return {
					id: `active:${activeUser.id}`,
					email: activeUser.email,
					displayName,
					status: TeamRecorderStatus.Active,
					userId: activeUser.id,
					inviteId: null
				}
			}
		)

		const activeEmails = new Set(
			activeEntries.map((entry) => entry.email.toLowerCase())
		)
		const pendingEntries: TeamRecorderEntryInterface[] = pendingInvites
			.filter((invite) => !activeEmails.has(invite.email.toLowerCase()))
			.map((invite) => ({
				id: `pending:${invite.id}`,
				email: invite.email,
				displayName: invite.email,
				status: TeamRecorderStatus.Pending,
				userId: null,
				inviteId: invite.id
			}))

		return [...pendingEntries, ...activeEntries].sort((a, b) =>
			a.email.localeCompare(b.email)
		)
	}

	public async cancelRecorderInvite({
		teamId,
		inviteId
	}: {
		teamId: string
		inviteId: string
	}): Promise<boolean> {
		const invite = await this.recorderInviteRepository.findOne({
			filter: {
				id: inviteId,
				teamId,
				status: RecorderInviteStatus.Pending
			}
		})
		if (!invite) {
			throw new Error('Invite not found or already used')
		}

		await this.recorderInviteRepository.update({
			filter: { id: invite.id, teamId },
			data: { status: RecorderInviteStatus.Cancelled }
		})
		return true
	}

	public async revokeRecorderAccess({
		teamId,
		userId
	}: {
		teamId: string
		userId: string
	}): Promise<boolean> {
		const team = await this.teamRepository.findOneOrFail({
			filter: { id: teamId }
		})

		const role = await this.userRoleRepository.findOne({
			filter: {
				userId,
				companyId: team.companyId
			}
		})
		if (!role || role.role !== UserRoles.Recorder) {
			throw new Error('User is not a recorder on this team')
		}

		await this.userRoleRepository.delete({ filter: { id: role.id } })
		await this.teamRepository.removeTeamUser({ teamId, userId })
		await this.companyRepository.removeCompanyUser({
			companyId: team.companyId,
			userId
		})

		const acceptedInvite = await this.recorderInviteRepository.findOne({
			filter: {
				teamId,
				status: RecorderInviteStatus.Accepted,
				acceptedByUserId: userId
			}
		})
		if (acceptedInvite) {
			await this.recorderInviteRepository.update({
				filter: { id: acceptedInvite.id, teamId },
				data: { status: RecorderInviteStatus.Cancelled }
			})
		}

		return true
	}

	public async resendRecorderInvite({
		teamId,
		inviteId
	}: {
		teamId: string
		inviteId: string
	}): Promise<RecorderInviteInterface> {
		const team = await this.teamRepository.findOneOrFail({
			filter: { id: teamId }
		})

		let invite = await this.recorderInviteRepository.findOne({
			filter: {
				id: inviteId,
				teamId,
				status: RecorderInviteStatus.Pending
			}
		})
		if (!invite) {
			throw new Error('Invite not found or already used')
		}

		if (invite.expiresAt < new Date()) {
			await this.recorderInviteRepository.update({
				filter: { id: invite.id, teamId },
				data: { status: RecorderInviteStatus.Expired }
			})
			await this.entitlementService.assertCanAddRecorder({
				companyId: team.companyId
			})
			invite = await this.createRecorderInviteRecord({
				teamId,
				email: invite.email
			})
		}

		await this.queueRecorderInviteEmail({ invite })
		return invite
	}

	public async findRecorderInvite({
		filter
	}: {
		filter: RecorderInviteFilter
	}): Promise<RecorderInviteInterface | null> {
		return this.recorderInviteRepository.findOne({ filter })
	}

	public async resolveJoinInfo({
		token
	}: {
		token: string
	}): Promise<JoinInfoInterface | null> {
		const invite = await this.findRecorderInvite({ filter: { token } })
		if (!invite) {
			return null
		}

		const team = await this.teamRepository.findOne({
			filter: { id: invite.teamId }
		})

		return {
			kind: JoinInviteKind.Recorder,
			teamId: invite.teamId,
			teamName: team?.name ?? '',
			email: invite.email,
			firstName: null,
			lastName: null,
			status: invite.status as AthleteInviteStatus
		}
	}

	public async acceptRecorderInvite({
		token,
		userId
	}: {
		token: string
		userId: string
	}): Promise<boolean> {
		const invite = await this.recorderInviteRepository.findOne({
			filter: { token, status: RecorderInviteStatus.Pending }
		})
		if (!invite) {
			const acceptedInvite = await this.recorderInviteRepository.findOne({
				filter: { token, status: RecorderInviteStatus.Accepted }
			})
			if (acceptedInvite) {
				await this.resolveAcceptedRecorderInvite({
					invite: acceptedInvite,
					userId
				})
				return true
			}
			throw new Error('Invalid or expired invite token')
		}

		if (invite.expiresAt < new Date()) {
			await this.recorderInviteRepository.update({
				filter: { id: invite.id },
				data: { status: RecorderInviteStatus.Expired }
			})
			throw new Error('Invite has expired')
		}

		await this.assertUserMatchesInviteEmail({
			userId,
			inviteEmail: invite.email
		})

		const team = await this.teamRepository.findOneOrFail({
			filter: { id: invite.teamId }
		})

		// Mark accepted before granting role so the pending invite no longer
		// occupies a seat while the Recorder role is created.
		await this.recorderInviteRepository.update({
			filter: { id: invite.id },
			data: {
				status: RecorderInviteStatus.Accepted,
				acceptedByUserId: userId
			}
		})

		await this.ensureRecorderMembership({
			userId,
			team,
			teamId: invite.teamId,
			seatAlreadyReserved: true
		})

		await this.notifyCoachOfRecorderJoin({
			team,
			teamId: invite.teamId,
			userId,
			inviteId: invite.id
		})

		return true
	}

	public async completeRecorderInviteSignup({
		token,
		clerkId,
		profile
	}: {
		token: string
		clerkId: string
		profile?: RecorderSignupProfile
	}): Promise<boolean> {
		const userId = await this.ensureUserForClerk({ clerkId, profile })
		return this.acceptRecorderInvite({ token, userId })
	}

	private async resolveAcceptedRecorderInvite({
		invite,
		userId
	}: {
		invite: RecorderInviteInterface
		userId: string
	}): Promise<void> {
		await this.assertUserMatchesInviteEmail({
			userId,
			inviteEmail: invite.email
		})

		const team = await this.teamRepository.findOneOrFail({
			filter: { id: invite.teamId }
		})

		await this.ensureRecorderMembership({
			userId,
			team,
			teamId: invite.teamId,
			seatAlreadyReserved: true
		})
	}

	private async ensureRecorderMembership({
		userId,
		team,
		teamId,
		seatAlreadyReserved = false
	}: {
		userId: string
		team: TeamInterface
		teamId: string
		seatAlreadyReserved?: boolean
	}): Promise<void> {
		const existingRole = await this.userRoleRepository.findOne({
			filter: {
				userId,
				companyId: team.companyId
			}
		})
		if (existingRole && existingRole.role !== UserRoles.Recorder) {
			throw new Error(
				'This account already has a different role on this team'
			)
		}
		if (!existingRole) {
			if (!seatAlreadyReserved) {
				await this.entitlementService.assertCanAddRecorder({
					companyId: team.companyId
				})
			}
			await this.userRoleRepository.create({
				data: {
					userId,
					companyId: team.companyId,
					role: UserRoles.Recorder
				}
			})
		}

		await this.companyRepository.addCompanyUser({
			companyId: team.companyId,
			userId
		})
		await this.teamRepository.addTeamUser({ teamId, userId })
	}

	private async createRecorderInviteRecord({
		teamId,
		email
	}: {
		teamId: string
		email: string
	}): Promise<RecorderInviteInterface> {
		const token = crypto.randomUUID()
		const expiresAt = addDays(new Date(), INVITE_EXPIRY_DAYS)
		return this.recorderInviteRepository.create({
			data: { teamId, email, token, expiresAt }
		})
	}

	private async tryQueueRecorderInviteEmail({
		invite
	}: {
		invite: RecorderInviteInterface
	}): Promise<boolean> {
		try {
			await this.queueRecorderInviteEmail({ invite })
			return true
		} catch (error) {
			this.reportingService.error({
				message: 'Failed to send recorder invite email',
				error: error as Error,
				inviteId: invite.id,
				email: invite.email,
				teamId: invite.teamId
			})
			return false
		}
	}

	private async queueRecorderInviteEmail({
		invite
	}: {
		invite: RecorderInviteInterface
	}): Promise<void> {
		const team = await this.teamRepository.findOne({
			filter: { id: invite.teamId }
		})
		if (!team) {
			throw new Error('Team not found for invite')
		}

		const coach = team.ownerId
			? await this.userRepository.findOne({ filter: { id: team.ownerId } })
			: null

		const coachName = coach
			? `${coach.firstName} ${coach.lastName}`.trim() || 'Your coach'
			: 'Your coach'

		const inviteUrl = buildRecorderInviteUrl({ token: invite.token })
		const { subject, text, html } = buildRecorderInviteEmail({
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
			jobId: `recorder-invite-${invite.id}-${Date.now()}`
		})
	}

	private async ensureUserForClerk({
		clerkId,
		profile
	}: {
		clerkId: string
		profile?: RecorderSignupProfile
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
		const user = await this.userRepository.findOneOrFail({
			filter: { id: userId }
		})

		if (user.email.toLowerCase() !== inviteEmail.toLowerCase()) {
			throw new Error(
				'This invite was sent to a different email address. Sign out and use the invited account.'
			)
		}
	}

	private async fetchClerkProfile({
		clerkId
	}: {
		clerkId: string
	}): Promise<RecorderSignupProfile> {
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
			avatar: clerkUser.imageUrl ?? ''
		}
	}

	private async notifyCoachOfRecorderJoin({
		team,
		teamId,
		userId,
		inviteId
	}: {
		team: TeamInterface | null
		teamId: string
		userId: string
		inviteId: string
	}): Promise<void> {
		const coachUserId = team?.ownerId
		if (!coachUserId) {
			return
		}

		const user = await this.userRepository.findOne({ filter: { id: userId } })
		const displayName = user
			? `${user.firstName} ${user.lastName}`.trim() || user.email
			: 'A recorder'

		await this.notificationRepository
			.create({
				data: {
					userId: coachUserId,
					teamId,
					type: NotificationType.Join,
					text: `${displayName} joined as a recorder helper.`,
					payload: {
						userId,
						inviteId,
						role: UserRoles.Recorder
					}
				}
			})
			.catch((e) => {
				this.reportingService.reportError({ error: e as Error })
			})
	}
}
