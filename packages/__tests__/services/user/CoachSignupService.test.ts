import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { UserStatus } from '@packages/enums'
import { AthleteInviteService } from '@packages/services/athleteInvite/AthleteInviteService'
import { CompanyService } from '@packages/services/company/CompanyService'
import { CoachLifecycleEmailService } from '@packages/services/email/CoachLifecycleEmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { CoachSignupService } from '@packages/services/user/CoachSignupService'
import { UserService } from '@packages/services/user/UserService'

import { buildMockUser } from '@builders/user'

jest.mock('@packages/services/communication/SlackService', () => ({
	__esModule: true,
	default: {
		sendSlackMessage: jest.fn().mockResolvedValue(undefined)
	}
}))

describe('CoachSignupService', () => {
	let service: CoachSignupService
	let mockUserService: jest.Mocked<UserService>
	let mockCompanyService: jest.Mocked<CompanyService>
	let mockAthleteInviteService: jest.Mocked<AthleteInviteService>
	let mockCoachLifecycleEmailService: jest.Mocked<CoachLifecycleEmailService>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockUserService = mock<UserService>()
		mockCompanyService = mock<CompanyService>()
		mockAthleteInviteService = mock<AthleteInviteService>()
		mockCoachLifecycleEmailService = mock<CoachLifecycleEmailService>()
		mockReportingService = mock<ReportingService>()

		container.registerInstance(UserService, mockUserService)
		container.registerInstance(CompanyService, mockCompanyService)
		container.registerInstance(AthleteInviteService, mockAthleteInviteService)
		container.registerInstance(
			CoachLifecycleEmailService,
			mockCoachLifecycleEmailService
		)
		container.registerInstance(ReportingService, mockReportingService)

		service = container.resolve(CoachSignupService)
	})

	afterEach(() => {
		container.clearInstances()
		jest.clearAllMocks()
	})

	describe('handleUserCreated', () => {
		it('relinks an existing email to the new clerkId instead of creating', async () => {
			const existingUser = buildMockUser({
				email: 'coach@example.com',
				clerkId: 'clerk_old_test_id',
				status: UserStatus.Active
			})

			mockUserService.countUsers.mockResolvedValue(0)
			mockUserService.findUser.mockResolvedValue(existingUser)
			mockUserService.updateUser.mockResolvedValue({
				...existingUser,
				clerkId: 'clerk_live_new_id'
			})

			await service.handleUserCreated({
				payload: {
					clerkId: 'clerk_live_new_id',
					firstName: 'Alex',
					lastName: 'Coach',
					email: 'coach@example.com',
					avatarUrl: 'https://example.com/a.png'
				}
			})

			expect(mockUserService.createUser).not.toHaveBeenCalled()
			expect(mockCompanyService.createCompany).not.toHaveBeenCalled()
			expect(mockUserService.updateUser).toHaveBeenCalledWith({
				filter: { id: existingUser.id },
				data: {
					clerkId: 'clerk_live_new_id',
					firstName: 'Alex',
					lastName: 'Coach',
					avatar: 'https://example.com/a.png',
					status: UserStatus.Active
				}
			})
		})

		it('creates a new user when email is not already registered', async () => {
			const createdUser = buildMockUser({
				email: 'newcoach@example.com',
				clerkId: 'clerk_new'
			})

			mockUserService.countUsers.mockResolvedValue(0)
			mockUserService.findUser.mockResolvedValue(null)
			mockUserService.createUser.mockResolvedValue(createdUser)
			mockCompanyService.createCompany.mockResolvedValue({
				company: {
					id: 'company-1',
					name: 'Alex Coach',
					ownerId: createdUser.id,
					settings: {},
					createdAt: new Date(),
					updatedAt: new Date()
				},
				user: createdUser,
				team: {
					id: 'team-1',
					name: 'Alex Coach',
					companyId: 'company-1',
					ownerId: createdUser.id,
					settings: {},
					createdAt: new Date(),
					updatedAt: new Date()
				}
			})

			await service.handleUserCreated({
				payload: {
					clerkId: 'clerk_new',
					firstName: 'Alex',
					lastName: 'Coach',
					email: 'newcoach@example.com'
				}
			})

			expect(mockUserService.createUser).toHaveBeenCalled()
			expect(mockCompanyService.createCompany).toHaveBeenCalled()
			expect(
				mockCoachLifecycleEmailService.enrollOnCoachSignup
			).toHaveBeenCalledWith({
				user: createdUser,
				companyId: 'company-1',
				teamId: 'team-1'
			})
		})
	})
})
