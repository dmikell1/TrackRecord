import { addDays, subDays } from 'date-fns'
import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { UserRoles, UserStatus } from '@packages/enums'
import {
	AthleteInviteStatus,
	JoinInviteKind,
	RecorderInviteStatus,
	TeamRecorderStatus
} from '@packages/enums/trackRecord'
import { CompanyRepository } from '@packages/repositories/company/CompanyRepository'
import { TrackRecordNotificationRepository } from '@packages/repositories/notification/TrackRecordNotificationRepository'
import { RecorderInviteRepository } from '@packages/repositories/recorderInvite/RecorderInviteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { UserRoleRepository } from '@packages/repositories/userRole/UserRoleRepository'
import {
	EntitlementService,
	RECORDER_SEAT_LIMIT_ERROR
} from '@packages/services/billing/EntitlementService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { RecorderInviteService } from '@packages/services/recorderInvite/RecorderInviteService'
import { UserService } from '@packages/services/user/UserService'
import type { TeamInterface } from '@packages/types/team'
import type { UserInterface } from '@packages/types/user'

import queueService from '@packages/services/queue/QueueService'

import { buildMockRecorderInvite } from '@builders/recorderInvite'

jest.mock('@packages/services/queue/QueueService', () => ({
	__esModule: true,
	default: {
		scheduleSendEmail: jest.fn().mockResolvedValue(undefined)
	}
}))

const mockQueueService = queueService as jest.Mocked<typeof queueService>

describe('RecorderInviteService', () => {
	let service: RecorderInviteService
	let mockRecorderInviteRepository: jest.Mocked<RecorderInviteRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockCompanyRepository: jest.Mocked<CompanyRepository>
	let mockUserRepository: jest.Mocked<UserRepository>
	let mockUserRoleRepository: jest.Mocked<UserRoleRepository>
	let mockUserService: jest.Mocked<UserService>
	let mockEntitlementService: jest.Mocked<EntitlementService>
	let mockNotificationRepository: jest.Mocked<TrackRecordNotificationRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	const team: TeamInterface = {
		id: 'team-1',
		name: 'Track Team',
		ownerId: 'coach-1',
		companyId: 'company-1',
		settings: {},
		createdAt: new Date(),
		updatedAt: new Date()
	}

	const user: UserInterface = {
		id: 'user-1',
		clerkId: 'clerk-1',
		firstName: 'Riley',
		lastName: 'Recorder',
		email: 'recorder@example.com',
		avatar: '',
		status: UserStatus.Active,
		invitedById: null,
		createdAt: new Date(),
		updatedAt: new Date()
	}

	beforeEach(() => {
		mockRecorderInviteRepository = mock<RecorderInviteRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockCompanyRepository = mock<CompanyRepository>()
		mockUserRepository = mock<UserRepository>()
		mockUserRoleRepository = mock<UserRoleRepository>()
		mockUserService = mock<UserService>()
		mockEntitlementService = mock<EntitlementService>()
		mockNotificationRepository = mock<TrackRecordNotificationRepository>()
		mockReportingService = mock<ReportingService>()

		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())
		mockEntitlementService.assertCanAddRecorder.mockResolvedValue(undefined)
		mockTeamRepository.findOneOrFail.mockResolvedValue(team)
		mockTeamRepository.findOne.mockResolvedValue(team)
		mockTeamRepository.addTeamUser.mockResolvedValue(undefined)
		mockCompanyRepository.addCompanyUser.mockResolvedValue(undefined)
		mockUserRoleRepository.findOne.mockResolvedValue(null)
		mockUserRoleRepository.create.mockResolvedValue({
			id: 'role-1',
			userId: user.id,
			companyId: team.companyId,
			role: UserRoles.Recorder
		})
		mockNotificationRepository.create.mockResolvedValue({
			id: 'notif-1',
			userId: 'coach-1',
			teamId: team.id,
			type: 'Join' as never,
			text: 'joined',
			payload: {},
			read: false,
			createdAt: new Date()
		})

		container.registerInstance(
			RecorderInviteRepository,
			mockRecorderInviteRepository
		)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(CompanyRepository, mockCompanyRepository)
		container.registerInstance(UserRepository, mockUserRepository)
		container.registerInstance(UserRoleRepository, mockUserRoleRepository)
		container.registerInstance(UserService, mockUserService)
		container.registerInstance(EntitlementService, mockEntitlementService)
		container.registerInstance(
			TrackRecordNotificationRepository,
			mockNotificationRepository
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(RecorderInviteService)
	})

	afterEach(() => {
		container.clearInstances()
		jest.clearAllMocks()
	})

	describe('createRecorderInvite', () => {
		it('creates invite after seat check and queues email', async () => {
			const expectedInvite = buildMockRecorderInvite({
				teamId: team.id,
				email: 'recorder@example.com'
			})
			mockRecorderInviteRepository.findOne.mockResolvedValue(null)
			mockRecorderInviteRepository.create.mockResolvedValue(expectedInvite)
			mockUserRepository.findOne.mockResolvedValue({
				...user,
				id: 'coach-1',
				email: 'coach@example.com',
				firstName: 'Coach',
				lastName: 'One'
			})

			const result = await service.createRecorderInvite({
				teamId: team.id,
				email: 'recorder@example.com'
			})

			expect(mockEntitlementService.assertCanAddRecorder).toHaveBeenCalledWith({
				companyId: team.companyId
			})
			expect(result).toEqual({ invite: expectedInvite, emailSent: true })
			expect(mockQueueService.scheduleSendEmail).toHaveBeenCalledWith(
				expect.objectContaining({
					to: 'recorder@example.com',
					subject: expect.stringContaining('recorder helper')
				})
			)
		})

		it('rejects when recorder seat limit is reached', async () => {
			mockEntitlementService.assertCanAddRecorder.mockRejectedValue(
				new Error(RECORDER_SEAT_LIMIT_ERROR)
			)

			await expect(
				service.createRecorderInvite({
					teamId: team.id,
					email: 'recorder@example.com'
				})
			).rejects.toThrow(RECORDER_SEAT_LIMIT_ERROR)
			expect(mockRecorderInviteRepository.create).not.toHaveBeenCalled()
		})
	})

	describe('acceptRecorderInvite', () => {
		it('grants Recorder role, company/team membership, and no athlete create', async () => {
			const invite = buildMockRecorderInvite({
				teamId: team.id,
				email: user.email,
				token: 'token-1',
				status: RecorderInviteStatus.Pending,
				expiresAt: addDays(new Date(), 3)
			})
			mockRecorderInviteRepository.findOne.mockResolvedValueOnce(invite)
			mockUserRepository.findOneOrFail.mockResolvedValue(user)
			mockUserRepository.findOne.mockResolvedValue(user)
			mockRecorderInviteRepository.update.mockResolvedValue({
				...invite,
				status: RecorderInviteStatus.Accepted,
				acceptedByUserId: user.id
			})

			const result = await service.acceptRecorderInvite({
				token: 'token-1',
				userId: user.id
			})

			expect(result).toBe(true)
			expect(mockRecorderInviteRepository.update).toHaveBeenCalledWith({
				filter: { id: invite.id },
				data: {
					status: RecorderInviteStatus.Accepted,
					acceptedByUserId: user.id
				}
			})
			expect(mockUserRoleRepository.create).toHaveBeenCalledWith({
				data: {
					userId: user.id,
					companyId: team.companyId,
					role: UserRoles.Recorder
				}
			})
			expect(
				mockEntitlementService.assertCanAddRecorder
			).not.toHaveBeenCalled()
			expect(mockCompanyRepository.addCompanyUser).toHaveBeenCalledWith({
				companyId: team.companyId,
				userId: user.id
			})
			expect(mockTeamRepository.addTeamUser).toHaveBeenCalledWith({
				teamId: team.id,
				userId: user.id
			})
		})

		it('rejects expired invites', async () => {
			const invite = buildMockRecorderInvite({
				teamId: team.id,
				email: user.email,
				token: 'token-1',
				status: RecorderInviteStatus.Pending,
				expiresAt: subDays(new Date(), 1)
			})
			mockRecorderInviteRepository.findOne.mockResolvedValueOnce(invite)
			mockRecorderInviteRepository.update.mockResolvedValue({
				...invite,
				status: RecorderInviteStatus.Expired
			})

			await expect(
				service.acceptRecorderInvite({
					token: 'token-1',
					userId: user.id
				})
			).rejects.toThrow('Invite has expired')
			expect(mockUserRoleRepository.create).not.toHaveBeenCalled()
		})
	})

	describe('resolveJoinInfo', () => {
		it('returns Recorder join kind', async () => {
			const invite = buildMockRecorderInvite({
				teamId: team.id,
				email: user.email,
				token: 'token-1',
				status: RecorderInviteStatus.Pending
			})
			mockRecorderInviteRepository.findOne.mockResolvedValue(invite)

			const result = await service.resolveJoinInfo({ token: 'token-1' })

			expect(result).toEqual({
				kind: JoinInviteKind.Recorder,
				teamId: team.id,
				teamName: team.name,
				email: user.email,
				firstName: null,
				lastName: null,
				status: AthleteInviteStatus.Pending
			})
		})
	})

	describe('listTeamRecorders', () => {
		it('returns pending invites and active recorders', async () => {
			const pendingInvite = buildMockRecorderInvite({
				id: 'invite-pending',
				teamId: team.id,
				email: 'pending@example.com',
				status: RecorderInviteStatus.Pending
			})
			mockRecorderInviteRepository.find.mockResolvedValue([pendingInvite])
			mockUserRoleRepository.find.mockResolvedValue([
				{
					id: 'role-1',
					userId: user.id,
					companyId: team.companyId,
					role: UserRoles.Recorder
				}
			])
			mockTeamRepository.findUserIdsByTeamId.mockResolvedValue([user.id])
			mockUserRepository.findByIds.mockResolvedValue([user])

			const result = await service.listTeamRecorders({ teamId: team.id })

			expect(result).toEqual([
				{
					id: `pending:${pendingInvite.id}`,
					email: 'pending@example.com',
					displayName: 'pending@example.com',
					status: TeamRecorderStatus.Pending,
					userId: null,
					inviteId: pendingInvite.id
				},
				{
					id: `active:${user.id}`,
					email: user.email,
					displayName: 'Riley Recorder',
					status: TeamRecorderStatus.Active,
					userId: user.id,
					inviteId: null
				}
			])
		})
	})

	describe('cancelRecorderInvite', () => {
		it('marks pending invite as cancelled', async () => {
			const invite = buildMockRecorderInvite({
				id: 'invite-1',
				teamId: team.id,
				status: RecorderInviteStatus.Pending
			})
			mockRecorderInviteRepository.findOne.mockResolvedValue(invite)
			mockRecorderInviteRepository.update.mockResolvedValue({
				...invite,
				status: RecorderInviteStatus.Cancelled
			})

			const result = await service.cancelRecorderInvite({
				teamId: team.id,
				inviteId: invite.id
			})

			expect(result).toBe(true)
			expect(mockRecorderInviteRepository.update).toHaveBeenCalledWith({
				filter: { id: invite.id, teamId: team.id },
				data: { status: RecorderInviteStatus.Cancelled }
			})
		})
	})

	describe('revokeRecorderAccess', () => {
		it('removes recorder role and membership', async () => {
			mockUserRoleRepository.findOne.mockResolvedValue({
				id: 'role-1',
				userId: user.id,
				companyId: team.companyId,
				role: UserRoles.Recorder
			})
			mockUserRoleRepository.delete.mockResolvedValue(true)
			mockTeamRepository.removeTeamUser.mockResolvedValue(undefined)
			mockCompanyRepository.removeCompanyUser.mockResolvedValue(undefined)
			mockRecorderInviteRepository.findOne.mockResolvedValue(
				buildMockRecorderInvite({
					id: 'invite-1',
					teamId: team.id,
					status: RecorderInviteStatus.Accepted,
					acceptedByUserId: user.id
				})
			)
			mockRecorderInviteRepository.update.mockResolvedValue(
				buildMockRecorderInvite({
					id: 'invite-1',
					status: RecorderInviteStatus.Cancelled
				})
			)

			const result = await service.revokeRecorderAccess({
				teamId: team.id,
				userId: user.id
			})

			expect(result).toBe(true)
			expect(mockUserRoleRepository.delete).toHaveBeenCalledWith({
				filter: { id: 'role-1' }
			})
			expect(mockTeamRepository.removeTeamUser).toHaveBeenCalledWith({
				teamId: team.id,
				userId: user.id
			})
			expect(mockCompanyRepository.removeCompanyUser).toHaveBeenCalledWith({
				companyId: team.companyId,
				userId: user.id
			})
		})

		it('rejects when user is not a recorder', async () => {
			mockUserRoleRepository.findOne.mockResolvedValue({
				id: 'role-1',
				userId: user.id,
				companyId: team.companyId,
				role: UserRoles.Owner
			})

			await expect(
				service.revokeRecorderAccess({
					teamId: team.id,
					userId: user.id
				})
			).rejects.toThrow('User is not a recorder on this team')
			expect(mockUserRoleRepository.delete).not.toHaveBeenCalled()
		})
	})
})
