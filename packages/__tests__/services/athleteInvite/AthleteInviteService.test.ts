import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { AthleteInviteStatus, JoinInviteKind, ParentalConsentStatus } from '@packages/enums/trackRecord'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { AthleteInviteRepository } from '@packages/repositories/athleteInvite/AthleteInviteRepository'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'

import queueService from '@packages/services/queue/QueueService'

import { buildMockAthlete } from '@builders/athlete'
import { buildMockAthleteInvite } from '@builders/athleteInvite'

jest.mock('@packages/services/queue/QueueService', () => ({
	__esModule: true,
	default: {
		scheduleSendEmail: jest.fn().mockResolvedValue(undefined)
	}
}))

const mockQueueService = queueService as jest.Mocked<typeof queueService>

const adultDateOfBirth = new Date('2008-01-15T00:00:00.000Z')
const under13DateOfBirth = new Date('2015-06-01T00:00:00.000Z')

describe('AthleteInviteService', () => {
	let service: AthleteInviteService
	let mockAthleteInviteRepository: jest.Mocked<AthleteInviteRepository>
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockNotificationRepository: jest.Mocked<TrackRecordNotificationRepository>
	let mockUserRepository: jest.Mocked<UserRepository>
	let mockUserService: jest.Mocked<UserService>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockAthleteInviteRepository = mock<AthleteInviteRepository>()
		mockAthleteRepository = mock<AthleteRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockNotificationRepository = mock<TrackRecordNotificationRepository>()
		mockUserRepository = mock<UserRepository>()
		mockUserService = mock<UserService>()
		mockReportingService = mock<ReportingService>()

		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockTeamRepository.findByInviteToken.mockResolvedValue(null)

		container.registerInstance(AthleteInviteRepository, mockAthleteInviteRepository)
		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(TrackRecordNotificationRepository, mockNotificationRepository)
		container.registerInstance(UserRepository, mockUserRepository)
		container.registerInstance(UserService, mockUserService)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(AthleteInviteService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	// ------------------------------------------------------------------
	describe('createAthleteInvite', () => {
		it('creates invite with a token, 7-day expiry, and queues invite email', async () => {
			const now = new Date()
			const expectedInvite = buildMockAthleteInvite({ teamId: 'team-1', email: 'runner@example.com' })
			mockAthleteInviteRepository.create.mockResolvedValue(expectedInvite)
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: null,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteRepository.findOne.mockResolvedValue(
				buildMockAthlete({
					teamId: 'team-1',
					email: 'runner@example.com',
					firstName: 'Riley',
					lastName: 'Runner'
				})
			)

			const result = await service.createAthleteInvite({ teamId: 'team-1', email: 'runner@example.com' })

			expect(result).toEqual({ invite: expectedInvite, emailSent: true })
			expect(mockAthleteInviteRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					teamId: 'team-1',
					email: 'runner@example.com',
					token: expect.any(String),
					expiresAt: expect.any(Date)
				})
			})
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'runner@example.com'
				})
			)

			const { expiresAt } = (mockAthleteInviteRepository.create.mock.calls[0]![0] as { data: { expiresAt: Date } }).data
			const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			expect(diffDays).toBeGreaterThanOrEqual(6.9)
			expect(diffDays).toBeLessThanOrEqual(7.1)
		})

		it('returns emailSent false when invite email fails', async () => {
			const expectedInvite = buildMockAthleteInvite({
				teamId: 'team-1',
				email: 'runner@example.com'
			})
			mockAthleteInviteRepository.create.mockResolvedValue(expectedInvite)
			mockQueueService.scheduleSendEmail.mockRejectedValue(
				new Error('Email service is not configured')
			)

			const result = await service.createAthleteInvite({
				teamId: 'team-1',
				email: 'runner@example.com'
			})

			expect(result).toEqual({ invite: expectedInvite, emailSent: false })
		})
	})

	// ------------------------------------------------------------------
	describe('sendAthleteInviteEmail', () => {
		it('queues invite email for a pending invite', async () => {
			const invite = buildMockAthleteInvite({
				id: 'invite-1',
				teamId: 'team-1',
				email: 'runner@example.com'
			})
			const athlete = buildMockAthlete({
				teamId: 'team-1',
				email: 'runner@example.com',
				firstName: 'Riley',
				lastName: 'Runner'
			})

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockUserRepository.findOne.mockResolvedValue({
				id: 'coach-1',
				firstName: 'Coach',
				lastName: 'Taylor',
				email: 'coach@example.com',
				avatar: '',
				status: 'Active',
				clerkId: 'clerk-coach',
				createdAt: new Date(),
				updatedAt: new Date()
			})

			const result = await service.sendAthleteInviteEmail({
				teamId: 'team-1',
				inviteId: 'invite-1'
			})

			expect(result).toBe(true)
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'runner@example.com',
					replyTo: 'coach@example.com'
				})
			)
		})
	})

	describe('resendAthleteInvite', () => {
		it('creates a new invite when none is pending and queues email', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-1',
				teamId: 'team-1',
				email: 'runner@example.com',
				userId: null
			})
			const invite = buildMockAthleteInvite({
				id: 'invite-2',
				teamId: 'team-1',
				email: 'runner@example.com'
			})

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteInviteRepository.findOne.mockResolvedValue(null)
			mockAthleteInviteRepository.create.mockResolvedValue(invite)
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: null,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteRepository.findOne.mockResolvedValue(athlete)

			const result = await service.resendAthleteInvite({
				teamId: 'team-1',
				athleteId: 'athlete-1'
			})

			expect(result).toEqual(invite)
			expect(mockAthleteInviteRepository.create).toHaveBeenCalled()
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledTimes(1)
		})

		it('throws when athlete is already connected', async () => {
			mockAthleteRepository.findOne.mockResolvedValue(
				buildMockAthlete({
					id: 'athlete-1',
					teamId: 'team-1',
					userId: 'user-1'
				})
			)

			await expect(
				service.resendAthleteInvite({ teamId: 'team-1', athleteId: 'athlete-1' })
			).rejects.toThrow('Athlete is already connected to the app')
		})
	})

	describe('getAthleteInviteLink', () => {
		it('returns invite URL for pending athlete with existing invite without sending email', async () => {
			const invite = buildMockAthleteInvite({
				teamId: 'team-1',
				email: 'runner@example.com',
				token: 'invite-token-abc'
			})
			const athlete = buildMockAthlete({
				id: 'athlete-1',
				teamId: 'team-1',
				email: 'runner@example.com',
				userId: null
			})

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)

			const result = await service.getAthleteInviteLink({
				teamId: 'team-1',
				athleteId: 'athlete-1'
			})

			expect(result).toContain('invite-token-abc')
			expect(mockAthleteInviteRepository.create).not.toHaveBeenCalled()
			expect(mockQueueService.scheduleSendEmail).not.toHaveBeenCalled()
		})

		it('creates invite when none is pending without sending email', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-1',
				teamId: 'team-1',
				email: 'runner@example.com',
				userId: null
			})
			const invite = buildMockAthleteInvite({
				teamId: 'team-1',
				email: 'runner@example.com',
				token: 'new-invite-token'
			})

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteInviteRepository.findOne.mockResolvedValue(null)
			mockAthleteInviteRepository.create.mockResolvedValue(invite)

			const result = await service.getAthleteInviteLink({
				teamId: 'team-1',
				athleteId: 'athlete-1'
			})

			expect(result).toContain('new-invite-token')
			expect(mockAthleteInviteRepository.create).toHaveBeenCalled()
			expect(mockQueueService.scheduleSendEmail).not.toHaveBeenCalled()
		})

		it('throws when athlete is already connected', async () => {
			mockAthleteRepository.findOne.mockResolvedValue(
				buildMockAthlete({
					id: 'athlete-1',
					teamId: 'team-1',
					userId: 'user-1'
				})
			)

			await expect(
				service.getAthleteInviteLink({ teamId: 'team-1', athleteId: 'athlete-1' })
			).rejects.toThrow('Athlete is already connected to the app')
		})
	})

	// ------------------------------------------------------------------
	describe('resolveJoinInfo', () => {
		it('returns athlete invite info when token matches an athlete invite', async () => {
			const invite = buildMockAthleteInvite({ teamId: 'team-1', email: 'runner@example.com' })
			const athlete = buildMockAthlete({
				teamId: 'team-1',
				email: 'runner@example.com',
				firstName: 'Riley',
				lastName: 'Runner'
			})

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})

			const result = await service.resolveJoinInfo({ token: invite.token })

			expect(result).toEqual({
				kind: JoinInviteKind.Athlete,
				teamId: 'team-1',
				teamName: 'Track Team',
				email: 'runner@example.com',
				firstName: 'Riley',
				lastName: 'Runner',
				status: invite.status
			})
		})

		it('returns team invite info when token matches a team invite link', async () => {
			mockAthleteInviteRepository.findOne.mockResolvedValue(null)
			mockTeamRepository.findByInviteToken.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: { inviteToken: 'team-token' },
				createdAt: new Date(),
				updatedAt: new Date()
			})

			const result = await service.resolveJoinInfo({ token: 'team-token' })

			expect(result).toEqual({
				kind: JoinInviteKind.Team,
				teamId: 'team-1',
				teamName: 'Track Team',
				email: null,
				status: null
			})
		})
	})

	// ------------------------------------------------------------------
	describe('acceptJoin', () => {
		it('creates an athlete when accepting a team invite link', async () => {
			const team = {
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: { inviteToken: 'team-token' },
				createdAt: new Date(),
				updatedAt: new Date()
			}
			const athlete = buildMockAthlete({
				teamId: team.id,
				companyId: team.companyId,
				email: 'runner@example.com',
				userId: 'user-1'
			})

			mockTeamRepository.findByInviteToken.mockResolvedValue(team)
			mockUserRepository.findOneOrFail.mockResolvedValue({
				id: 'user-1',
				firstName: 'Riley',
				lastName: 'Runner',
				email: 'runner@example.com',
				avatar: '',
				status: 'Active',
				clerkId: 'clerk-1',
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteRepository.findOne.mockResolvedValue(null)
			mockAthleteRepository.create.mockResolvedValue(athlete)
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
			mockTeamRepository.findOne.mockResolvedValue(team)
			mockNotificationRepository.create.mockResolvedValue({
				id: 'notif-1',
				userId: 'coach-1',
				teamId: team.id,
				type: 'Join',
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			const result = await service.acceptJoin({
				token: 'team-token',
				userId: 'user-1',
				dateOfBirth: adultDateOfBirth
			})

			expect(mockAthleteRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					teamId: team.id,
					companyId: team.companyId,
					firstName: 'Riley',
					lastName: 'Runner',
					email: 'runner@example.com',
					userId: 'user-1',
					dateOfBirth: adultDateOfBirth,
					parentalConsentStatus: ParentalConsentStatus.NotRequired
				})
			})
			expect(result).toEqual(athlete)
		})
	})

	const mockUserById = ({
		userId = 'user-1',
		email = 'runner@example.com'
	}: {
		userId?: string
		email?: string
	} = {}): void => {
		mockUserRepository.findOneOrFail.mockResolvedValue({
			id: userId,
			firstName: 'Test',
			lastName: 'User',
			email,
			avatar: '',
			status: 'Active',
			clerkId: 'clerk-1',
			createdAt: new Date(),
			updatedAt: new Date()
		} as never)
	}

	// ------------------------------------------------------------------
	describe('acceptAthleteInvite', () => {
		it('throws when invite is not found', async () => {
			mockAthleteInviteRepository.findOne.mockResolvedValue(null)

			await expect(
				service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: 'bad-token', userId: 'user-1' })
			).rejects.toThrow('Invalid or expired invite token')
		})

		it('returns linked athlete when invite was already accepted', async () => {
			const athlete = buildMockAthlete({
				email: 'runner@example.com',
				userId: 'user-1'
			})
			const invite = buildMockAthleteInvite({
				teamId: athlete.teamId,
				email: athlete.email,
				status: AthleteInviteStatus.Accepted
			})

			mockAthleteInviteRepository.findOne
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(invite)
			mockUserById({ email: athlete.email })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)

			const result = await service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth,
				token: invite.token,
				userId: 'user-1'
			})

			expect(result.userId).toBe('user-1')
			expect(mockTeamRepository.addTeamUser).toHaveBeenCalledWith({
				teamId: invite.teamId,
				userId: 'user-1'
			})
		})

		it('throws and marks expired when invite is past expiry', async () => {
			const expiredInvite = buildMockAthleteInvite({
				expiresAt: new Date(Date.now() - 1000)
			})
			mockAthleteInviteRepository.findOne.mockResolvedValue(expiredInvite)
			mockAthleteInviteRepository.update.mockResolvedValue(expiredInvite)

			await expect(
				service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: expiredInvite.token, userId: 'user-1' })
			).rejects.toThrow('Invite has expired')

			expect(mockAthleteInviteRepository.update).toHaveBeenCalledWith({
				filter: { id: expiredInvite.id },
				data: { status: AthleteInviteStatus.Expired }
			})
		})

		it('throws when signed-in user email does not match invite email', async () => {
			const invite = buildMockAthleteInvite({ email: 'test3@example.com' })
			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: 'test1@example.com' })

			await expect(
				service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: invite.token, userId: 'user-1' })
			).rejects.toThrow(
				'This invite was sent to a different email address. Sign out and use the invited account.'
			)
		})

		it('throws when athlete record is not found for the invite email', async () => {
			const invite = buildMockAthleteInvite()
			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: invite.email })
			mockAthleteRepository.findOne.mockResolvedValue(null)

			await expect(
				service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: invite.token, userId: 'user-1' })
			).rejects.toThrow('Athlete record not found for this invite')
		})

		it('links userId, adds teamUser, marks invite accepted, notifies coach', async () => {
			const athlete = buildMockAthlete({ email: 'runner@example.com' })
			const invite = buildMockAthleteInvite({ teamId: athlete.teamId, email: athlete.email })
			const updatedAthlete = { ...athlete, userId: 'user-1' }
			const coachUserId = 'coach-user-1'

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: athlete.email })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.linkUser.mockResolvedValue(updatedAthlete)
			mockAthleteRepository.update.mockResolvedValue({
				...updatedAthlete,
				dateOfBirth: adultDateOfBirth,
				parentalConsentStatus: ParentalConsentStatus.NotRequired
			})
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
			mockTeamRepository.findOne.mockResolvedValue({
				id: invite.teamId,
				name: 'Track Team',
				ownerId: coachUserId,
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteInviteRepository.update.mockResolvedValue({ ...invite, status: AthleteInviteStatus.Accepted })
			mockNotificationRepository.create.mockResolvedValue({
				id: 'notif-1',
				userId: coachUserId,
				teamId: invite.teamId,
				type: 'Join',
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			const result = await service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: invite.token, userId: 'user-1' })

			expect(mockAthleteRepository.linkUser).toHaveBeenCalledWith({ id: athlete.id, userId: 'user-1' })
			expect(mockTeamRepository.addTeamUser).toHaveBeenCalledWith({ teamId: invite.teamId, userId: 'user-1' })
			expect(mockAthleteInviteRepository.update).toHaveBeenCalledWith({
				filter: { id: invite.id },
				data: { status: AthleteInviteStatus.Accepted, acceptedByUserId: 'user-1' }
			})
			expect(mockNotificationRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					userId: coachUserId,
					teamId: invite.teamId,
					type: 'Join'
				})
			})
			expect(result.userId).toBe('user-1')
		})

		it('does not throw if notification creation fails', async () => {
			const athlete = buildMockAthlete()
			const invite = buildMockAthleteInvite({ teamId: athlete.teamId, email: athlete.email })
			const updatedAthlete = {
				...athlete,
				userId: 'user-1',
				dateOfBirth: adultDateOfBirth,
				parentalConsentStatus: ParentalConsentStatus.NotRequired
			}

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: athlete.email })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.linkUser.mockResolvedValue(updatedAthlete)
			mockAthleteRepository.update.mockResolvedValue(updatedAthlete)
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
			mockTeamRepository.findOne.mockResolvedValue({
				id: invite.teamId,
				name: 'Track Team',
				ownerId: 'coach-user-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteInviteRepository.update.mockResolvedValue({ ...invite, status: AthleteInviteStatus.Accepted })
			mockNotificationRepository.create.mockRejectedValue(new Error('DB error'))

			await expect(
				service.acceptAthleteInvite({
				dateOfBirth: adultDateOfBirth, token: invite.token, userId: 'user-1' })
			).resolves.toBeDefined()

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})

		it('requires parent email and queues consent email for under-13 athletes', async () => {
			const athlete = buildMockAthlete({ email: 'kid@example.com' })
			const invite = buildMockAthleteInvite({ teamId: athlete.teamId, email: athlete.email })
			const pendingAthlete = {
				...athlete,
				userId: 'user-1',
				dateOfBirth: under13DateOfBirth,
				parentalConsentStatus: ParentalConsentStatus.Pending,
				parentEmail: 'parent@example.com',
				parentalConsentToken: 'consent-token-1'
			}

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: athlete.email })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.linkUser.mockResolvedValue({ ...athlete, userId: 'user-1' })
			mockAthleteRepository.update.mockResolvedValue(pendingAthlete)
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
			mockTeamRepository.findOne.mockResolvedValue({
				id: invite.teamId,
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteInviteRepository.update.mockResolvedValue({
				...invite,
				status: AthleteInviteStatus.Accepted
			})
			mockNotificationRepository.create.mockResolvedValue({
				id: 'notif-1',
				userId: 'coach-1',
				teamId: invite.teamId,
				type: 'Join',
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			const result = await service.acceptAthleteInvite({
				dateOfBirth: under13DateOfBirth,
				parentEmail: 'parent@example.com',
				token: invite.token,
				userId: 'user-1'
			})

			expect(result.parentalConsentStatus).toBe(ParentalConsentStatus.Pending)
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'parent@example.com'
				})
			)
		})

		it('throws when under-13 join is missing parent email', async () => {
			const athlete = buildMockAthlete({ email: 'kid@example.com' })
			const invite = buildMockAthleteInvite({ teamId: athlete.teamId, email: athlete.email })

			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockUserById({ email: athlete.email })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.linkUser.mockResolvedValue({ ...athlete, userId: 'user-1' })

			await expect(
				service.acceptAthleteInvite({
					dateOfBirth: under13DateOfBirth,
					token: invite.token,
					userId: 'user-1'
				})
			).rejects.toThrow('A valid parent or guardian email is required')
		})
	})

	describe('grantParentalConsent', () => {
		it('grants consent for a pending athlete', async () => {
			const athlete = buildMockAthlete({
				parentalConsentStatus: ParentalConsentStatus.Pending,
				parentalConsentToken: 'consent-token',
				parentEmail: 'parent@example.com'
			})
			const granted = {
				...athlete,
				parentalConsentStatus: ParentalConsentStatus.Granted,
				parentalConsentToken: null,
				parentalConsentAt: new Date()
			}

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.update.mockResolvedValue(granted)

			const result = await service.grantParentalConsent({ token: 'consent-token' })

			expect(result.parentalConsentStatus).toBe(ParentalConsentStatus.Granted)
		})
	})

	describe('resendParentalConsentEmail', () => {
		it('queues a new parental consent email for the linked athlete', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-1',
				teamId: 'team-1',
				userId: 'user-1',
				parentalConsentStatus: ParentalConsentStatus.Pending,
				parentEmail: 'parent@example.com',
				parentalConsentToken: 'consent-token-1'
			})

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})

			const result = await service.resendParentalConsentEmail({
				athleteId: 'athlete-1',
				teamId: 'team-1',
				userId: 'user-1'
			})

			expect(result).toBe(true)
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'parent@example.com'
				})
			)
		})

		it('regenerates a missing consent token before sending', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-1',
				teamId: 'team-1',
				userId: 'user-1',
				parentalConsentStatus: ParentalConsentStatus.Pending,
				parentEmail: 'parent@example.com',
				parentalConsentToken: null
			})

			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.update.mockResolvedValue({
				...athlete,
				parentalConsentToken: 'new-token'
			})
			mockTeamRepository.findOne.mockResolvedValue({
				id: 'team-1',
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})

			await service.resendParentalConsentEmail({
				athleteId: 'athlete-1',
				teamId: 'team-1',
				userId: 'user-1'
			})

			expect(mockAthleteRepository.update).toHaveBeenCalledWith(
				expect.objectContaining({
					filter: { id: 'athlete-1' },
					data: expect.objectContaining({
						parentalConsentToken: expect.any(String)
					})
				})
			)
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledTimes(1)
		})

		it('throws when another user tries to resend', async () => {
			mockAthleteRepository.findOne.mockResolvedValue(
				buildMockAthlete({
					id: 'athlete-1',
					teamId: 'team-1',
					userId: 'user-1',
					parentalConsentStatus: ParentalConsentStatus.Pending,
					parentEmail: 'parent@example.com',
					parentalConsentToken: 'consent-token-1'
				})
			)

			await expect(
				service.resendParentalConsentEmail({
					athleteId: 'athlete-1',
					teamId: 'team-1',
					userId: 'other-user'
				})
			).rejects.toThrow(
				'Only the athlete can resend their parental consent email'
			)
		})

		it('throws when parental consent is not pending', async () => {
			mockAthleteRepository.findOne.mockResolvedValue(
				buildMockAthlete({
					id: 'athlete-1',
					teamId: 'team-1',
					userId: 'user-1',
					parentalConsentStatus: ParentalConsentStatus.Granted,
					parentEmail: 'parent@example.com'
				})
			)

			await expect(
				service.resendParentalConsentEmail({
					athleteId: 'athlete-1',
					teamId: 'team-1',
					userId: 'user-1'
				})
			).rejects.toThrow('Parental consent is not pending for this athlete')
		})
	})

	describe('completeAthleteInviteSignup', () => {

		it('creates backend user from profile and accepts a pending invite', async () => {
			const athlete = buildMockAthlete({ email: 'runner@example.com' })
			const invite = buildMockAthleteInvite({
				teamId: athlete.teamId,
				email: athlete.email
			})
			const createdUser = {
				id: 'user-1',
				firstName: 'Runner',
				lastName: 'Example',
				email: athlete.email,
				avatar: '',
				status: 'Active',
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockUserRepository.findOne.mockResolvedValue(null)
			mockUserById({ email: athlete.email })
			mockUserService.createUser.mockResolvedValue(createdUser as never)
			mockAthleteInviteRepository.findOne
				.mockResolvedValueOnce(invite)
				.mockResolvedValueOnce(invite)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.linkUser.mockResolvedValue({ ...athlete, userId: 'user-1' })
			mockAthleteRepository.update.mockResolvedValue({
				...athlete,
				userId: 'user-1',
				dateOfBirth: adultDateOfBirth,
				parentalConsentStatus: ParentalConsentStatus.NotRequired
			})
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
			mockTeamRepository.findOne.mockResolvedValue({
				id: invite.teamId,
				name: 'Track Team',
				ownerId: 'coach-1',
				companyId: 'company-1',
				settings: {},
				createdAt: new Date(),
				updatedAt: new Date()
			})
			mockAthleteInviteRepository.update.mockResolvedValue({
				...invite,
				status: AthleteInviteStatus.Accepted
			})
			mockNotificationRepository.create.mockResolvedValue({
				id: 'notif-1',
				userId: 'coach-1',
				teamId: invite.teamId,
				type: 'Join',
				text: '',
				payload: null,
				read: false,
				createdAt: new Date()
			})

			const result = await service.completeAthleteInviteSignup({
				token: invite.token,
				clerkId: 'clerk-1',
				dateOfBirth: adultDateOfBirth,
				profile: {
					firstName: 'Runner',
					lastName: 'Example',
					email: athlete.email,
					avatar: ''
				}
			})

			expect(mockUserService.createUser).toHaveBeenCalled()
			expect(result.userId).toBe('user-1')
		})

		it('returns athlete idempotently when invite is already accepted', async () => {
			const athlete = buildMockAthlete({
				email: 'runner@example.com',
				userId: 'user-1'
			})
			const invite = buildMockAthleteInvite({
				teamId: athlete.teamId,
				email: athlete.email,
				status: AthleteInviteStatus.Accepted
			})

			mockUserRepository.findOne.mockResolvedValue({
				id: 'user-1',
				firstName: athlete.firstName,
				lastName: athlete.lastName,
				email: athlete.email,
				avatar: '',
				status: 'Active',
				createdAt: new Date(),
				updatedAt: new Date()
			} as never)
			mockUserById({ email: athlete.email })
			mockAthleteInviteRepository.findOne.mockResolvedValue(invite)
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockTeamRepository.addTeamUser.mockResolvedValue(undefined)

			const result = await service.completeAthleteInviteSignup({
				dateOfBirth: adultDateOfBirth,
				token: invite.token,
				clerkId: 'clerk-1'
			})

			expect(mockUserService.createUser).not.toHaveBeenCalled()
			expect(result.userId).toBe('user-1')
		})
	})
})
