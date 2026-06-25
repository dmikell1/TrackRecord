import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { BulkAthleteImportIssueReason } from '@packages/enums/trackRecord'
import { AthleteRepository } from '@packages/repositories/athlete/AthleteRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { VideoPerformanceRepository } from '@packages/repositories/videoPerformance/VideoPerformanceRepository'
import { VideoRepository } from '@packages/repositories/video/VideoRepository'
import { AthleteService } from '@packages/services/athlete/AthleteService'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { buildMockAthlete } from '@builders/athlete'
import { buildMockTeam } from '@builders/team'

describe('AthleteService', () => {
	let athleteService: AthleteService
	let mockAthleteRepository: jest.Mocked<AthleteRepository>
	let mockTeamRepository: jest.Mocked<TeamRepository>
	let mockVideoRepository: jest.Mocked<VideoRepository>
	let mockVideoPerformanceRepository: jest.Mocked<VideoPerformanceRepository>
	let mockAthleteInviteService: jest.Mocked<AthleteInviteService>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockAthleteRepository = mock<AthleteRepository>()
		mockTeamRepository = mock<TeamRepository>()
		mockVideoRepository = mock<VideoRepository>()
		mockVideoPerformanceRepository = mock<VideoPerformanceRepository>()
		mockAthleteInviteService = mock<AthleteInviteService>()
		mockReportingService = mock<ReportingService>()

		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())

		container.registerInstance(AthleteRepository, mockAthleteRepository)
		container.registerInstance(TeamRepository, mockTeamRepository)
		container.registerInstance(VideoRepository, mockVideoRepository)
		container.registerInstance(
			VideoPerformanceRepository,
			mockVideoPerformanceRepository
		)
		container.registerInstance(AthleteInviteService, mockAthleteInviteService)
		container.registerInstance(ReportingService, mockReportingService)

		athleteService = container.resolve(AthleteService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	describe('bulkCreateAthletes', () => {
		it('should create valid athletes and skip duplicates and invalid rows', async () => {
			const team = buildMockTeam({ id: 'team-1', companyId: 'company-1' })
			const createdAthlete = buildMockAthlete({
				id: 'athlete-new',
				teamId: team.id,
				companyId: team.companyId,
				email: 'new@example.com'
			})

			mockTeamRepository.findOne.mockResolvedValue(team)
			mockAthleteRepository.findByEmailsInTeam.mockResolvedValue([
				buildMockAthlete({ email: 'existing@example.com', teamId: team.id })
			])
			mockAthleteRepository.createMany.mockResolvedValue([createdAthlete])

			const result = await athleteService.bulkCreateAthletes({
				teamId: team.id,
				companyId: team.companyId,
				athletes: [
					{
						firstName: 'New',
						lastName: 'Athlete',
						email: 'new@example.com'
					},
					{
						firstName: 'Existing',
						lastName: 'Athlete',
						email: 'existing@example.com'
					},
					{
						firstName: 'New',
						lastName: 'Athlete',
						email: 'new@example.com'
					},
					{
						firstName: '',
						lastName: 'Athlete',
						email: 'bad@example.com'
					},
					{
						firstName: 'Invalid',
						lastName: 'Email',
						email: 'not-an-email'
					}
				]
			})

			expect(result.created).toEqual([createdAthlete])
			expect(result.skipped).toEqual([
				{
					row: 1,
					email: 'existing@example.com',
					reason: BulkAthleteImportIssueReason.AlreadyOnTeam
				},
				{
					row: 2,
					email: 'new@example.com',
					reason: BulkAthleteImportIssueReason.DuplicateInBatch
				}
			])
			expect(result.failed).toEqual([
				{
					row: 3,
					email: 'bad@example.com',
					reason: BulkAthleteImportIssueReason.MissingName
				},
				{
					row: 4,
					email: 'not-an-email',
					reason: BulkAthleteImportIssueReason.InvalidEmail
				}
			])
			expect(mockAthleteRepository.createMany).toHaveBeenCalledWith({
				data: [
					expect.objectContaining({
						teamId: team.id,
						companyId: team.companyId,
						firstName: 'New',
						lastName: 'Athlete',
						email: 'new@example.com'
					})
				]
			})
			expect(mockAthleteInviteService.createAthleteInvite).not.toHaveBeenCalled()
		})

		it('should report invite email failures without failing import', async () => {
			const team = buildMockTeam({ id: 'team-1', companyId: 'company-1' })
			const createdAthlete = buildMockAthlete({
				email: 'invite@example.com',
				teamId: team.id,
				companyId: team.companyId
			})
			const createdInvite = {
				id: 'invite-1',
				teamId: team.id,
				email: createdAthlete.email,
				token: 'token-1',
				status: 'Pending',
				expiresAt: new Date(),
				acceptedByUserId: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockTeamRepository.findOne.mockResolvedValue(team)
			mockAthleteRepository.findByEmailsInTeam.mockResolvedValue([])
			mockAthleteRepository.createMany.mockResolvedValue([createdAthlete])
			mockAthleteInviteService.createAthleteInvite.mockResolvedValue({
				invite: createdInvite,
				emailSent: false
			})

			const result = await athleteService.bulkCreateAthletes({
				teamId: team.id,
				companyId: team.companyId,
				athletes: [
					{
						firstName: 'Invite',
						lastName: 'Me',
						email: 'invite@example.com'
					}
				],
				sendInvites: true
			})

			expect(result.created).toEqual([createdAthlete])
			expect(result.inviteEmailsFailed).toEqual([
				{
					row: 0,
					email: 'invite@example.com',
					reason: BulkAthleteImportIssueReason.InviteEmailFailed
				}
			])
		})

		it('should queue invites when sendInvites is true', async () => {
			const team = buildMockTeam({ id: 'team-1', companyId: 'company-1' })
			const createdAthlete = buildMockAthlete({
				email: 'invite@example.com',
				teamId: team.id,
				companyId: team.companyId
			})

			mockTeamRepository.findOne.mockResolvedValue(team)
			mockAthleteRepository.findByEmailsInTeam.mockResolvedValue([])
			mockAthleteRepository.createMany.mockResolvedValue([createdAthlete])
			mockAthleteInviteService.createAthleteInvite.mockResolvedValue({
				invite: {
					id: 'invite-1',
					teamId: team.id,
					email: createdAthlete.email,
					token: 'token-1',
					status: 'Pending',
					expiresAt: new Date(),
					acceptedByUserId: null,
					createdAt: new Date(),
					updatedAt: new Date()
				},
				emailSent: true
			})

			await athleteService.bulkCreateAthletes({
				teamId: team.id,
				companyId: team.companyId,
				athletes: [
					{
						firstName: 'Invite',
						lastName: 'Me',
						email: 'invite@example.com'
					}
				],
				sendInvites: true
			})

			expect(mockAthleteInviteService.createAthleteInvite).toHaveBeenCalledWith({
				teamId: team.id,
				email: 'invite@example.com'
			})
		})

		it('should queue invite when sendInvite is true', async () => {
			const createdAthlete = buildMockAthlete({
				id: 'athlete-new',
				teamId: 'team-1',
				companyId: 'company-1',
				email: 'invite@example.com'
			})
			const createdInvite = {
				id: 'invite-1',
				teamId: 'team-1',
				email: 'invite@example.com',
				token: 'token-1',
				status: 'Pending',
				expiresAt: new Date(),
				acceptedByUserId: null,
				createdAt: new Date(),
				updatedAt: new Date()
			}

			mockAthleteRepository.create.mockResolvedValue(createdAthlete)
			mockAthleteInviteService.createAthleteInvite.mockResolvedValue({
				invite: createdInvite,
				emailSent: true
			})

			const result = await athleteService.createAthlete({
				data: {
					teamId: 'team-1',
					companyId: 'company-1',
					firstName: 'Invite',
					lastName: 'Me',
					email: 'invite@example.com',
					color: '#3B82F6'
				},
				sendInvite: true
			})

			expect(result).toEqual({
				athlete: createdAthlete,
				invite: createdInvite,
				inviteEmailSent: true
			})
			expect(mockAthleteInviteService.createAthleteInvite).toHaveBeenCalledWith({
				teamId: 'team-1',
				email: 'invite@example.com'
			})
		})

		it('should throw when batch exceeds the maximum size', async () => {
			const athletes = Array.from({ length: 51 }, (_, index) => ({
				firstName: 'Athlete',
				lastName: String(index),
				email: `athlete${index}@example.com`
			}))

			await expect(
				athleteService.bulkCreateAthletes({
					teamId: 'team-1',
					companyId: 'company-1',
					athletes
				})
			).rejects.toThrow('Cannot import more than 50 athletes at once')
		})

		it('should throw when team does not belong to company', async () => {
			mockTeamRepository.findOne.mockResolvedValue(
				buildMockTeam({ id: 'team-1', companyId: 'company-1' })
			)

			await expect(
				athleteService.bulkCreateAthletes({
					teamId: 'team-1',
					companyId: 'other-company',
					athletes: [
						{
							firstName: 'Jane',
							lastName: 'Doe',
							email: 'jane@example.com'
						}
					]
				})
			).rejects.toThrow('Team does not belong to the specified company')
		})
	})

	describe('deleteAthlete', () => {
		it('should soft delete athlete and keep videos when deleteVideos is false', async () => {
			const athlete = buildMockAthlete({ id: 'athlete-1', teamId: 'team-1' })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.softDelete.mockResolvedValue({
				...athlete,
				deletedAt: new Date()
			})

			const result = await athleteService.deleteAthlete({
				id: athlete.id,
				teamId: athlete.teamId,
				deleteVideos: false
			})

			expect(result).toBe(true)
			expect(mockVideoRepository.deleteByAthleteId).not.toHaveBeenCalled()
			expect(mockAthleteRepository.softDelete).toHaveBeenCalledWith({
				id: athlete.id,
				teamId: athlete.teamId
			})
		})

		it('should delete videos before soft deleting athlete when deleteVideos is true', async () => {
			const athlete = buildMockAthlete({ id: 'athlete-2', teamId: 'team-1' })
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockVideoRepository.deleteByAthleteId.mockResolvedValue()
			mockAthleteRepository.softDelete.mockResolvedValue({
				...athlete,
				deletedAt: new Date()
			})

			const result = await athleteService.deleteAthlete({
				id: athlete.id,
				teamId: athlete.teamId,
				deleteVideos: true
			})

			expect(result).toBe(true)
			expect(mockVideoRepository.deleteByAthleteId).toHaveBeenCalledWith({
				athleteId: athlete.id,
				teamId: athlete.teamId
			})
			expect(mockAthleteRepository.softDelete).toHaveBeenCalledWith({
				id: athlete.id,
				teamId: athlete.teamId
			})
		})

		it('should throw when athlete is not found', async () => {
			mockAthleteRepository.findOne.mockResolvedValue(null)

			await expect(
				athleteService.deleteAthlete({
					id: 'missing-athlete',
					teamId: 'team-1',
					deleteVideos: false
				})
			).rejects.toThrow('Athlete with id missing-athlete not found')

			expect(mockVideoRepository.deleteByAthleteId).not.toHaveBeenCalled()
			expect(mockAthleteRepository.softDelete).not.toHaveBeenCalled()
			expect(mockTeamRepository.removeTeamUser).not.toHaveBeenCalled()
		})

		it('should revoke team membership when deleted athlete has a linked user', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-3',
				teamId: 'team-1',
				userId: 'user-1'
			})
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.softDelete.mockResolvedValue({
				...athlete,
				deletedAt: new Date()
			})
			mockTeamRepository.removeTeamUser.mockResolvedValue(undefined)

			const result = await athleteService.deleteAthlete({
				id: athlete.id,
				teamId: athlete.teamId,
				deleteVideos: false
			})

			expect(result).toBe(true)
			expect(mockTeamRepository.removeTeamUser).toHaveBeenCalledWith({
				teamId: athlete.teamId,
				userId: 'user-1'
			})
		})

		it('should not revoke team membership when athlete has no linked user', async () => {
			const athlete = buildMockAthlete({
				id: 'athlete-4',
				teamId: 'team-1',
				userId: undefined
			})
			mockAthleteRepository.findOne.mockResolvedValue(athlete)
			mockAthleteRepository.softDelete.mockResolvedValue({
				...athlete,
				deletedAt: new Date()
			})

			const result = await athleteService.deleteAthlete({
				id: athlete.id,
				teamId: athlete.teamId,
				deleteVideos: false
			})

			expect(result).toBe(true)
			expect(mockTeamRepository.removeTeamUser).not.toHaveBeenCalled()
		})
	})
})
