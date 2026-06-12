import { CompanyService } from '@packages/services/company/CompanyService'
import { TeamService } from '@packages/services/team/TeamService'
import { UserService } from '@packages/services/user/UserService'
import { container } from 'tsyringe'

import { createMockCompanyInput } from '@test-utils/builders/company'
import { createMockUserData } from '@test-utils/builders/user'
import {
	connectIntegrationTestDb,
	disconnectIntegrationTestDb,
	resetIntegrationTestDb
} from '@test-utils/jest/dbTestHooks'

describe('TeamService', () => {
	beforeAll(async () => {
		await connectIntegrationTestDb()
	})

	afterAll(async () => {
		await disconnectIntegrationTestDb()
	})

	beforeEach(async () => {
		await resetIntegrationTestDb()
	})

	it('should create a new team', async () => {
		const service = container.resolve(TeamService)
		const userService = container.resolve(UserService)
		const companyService = container.resolve(CompanyService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await companyService.createCompany({
			data: companyInput
		})

		const team = await service.createTeam({
			teamData: {
				name: 'Test Team',
				ownerId: user.id,
				companyId: company.id
			}
		})

		expect(team).toBeDefined()
		expect(team?.name).toBe('Test Team')
	})

	it('should find a team by name', async () => {
		const service = container.resolve(TeamService)
		const userService = container.resolve(UserService)
		const companyService = container.resolve(CompanyService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await companyService.createCompany({
			data: companyInput
		})

		const team = await service.createTeam({
			teamData: {
				name: 'Test Team',
				ownerId: user.id,
				companyId: company.id
			}
		})
		const result = await service.findTeam({ filter: { name: team?.name } })

		expect(result).toBeDefined()
		expect(result?.name).toBe(team.name)
	})

	it('should find all teams', async () => {
		const service = container.resolve(TeamService)
		const userService = container.resolve(UserService)
		const companyService = container.resolve(CompanyService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company, team: autoCreatedTeam } =
			await companyService.createCompany({ data: companyInput })

		await service.deleteTeam({ filter: { id: autoCreatedTeam.id } })

		await service.createTeam({
			teamData: {
				name: 'Team 1',
				ownerId: user.id,
				companyId: company.id
			}
		})
		await service.createTeam({
			teamData: {
				name: 'Team 2',
				ownerId: user.id,
				companyId: company.id
			}
		})

		const result = await service.findTeams({ filter: {} })

		expect(result).toBeDefined()
		expect(result.length).toBe(2)
	})

	it('should throw an error if team is not found', async () => {
		const service = container.resolve(TeamService)

		await expect(
			service.findTeamOrFail({ filter: { name: 'invalid-name-xyz' } })
		).rejects.toThrow()
	})

	it('should find a team or throw an error', async () => {
		const service = container.resolve(TeamService)
		const userService = container.resolve(UserService)
		const companyService = container.resolve(CompanyService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await companyService.createCompany({
			data: companyInput
		})

		const team = await service.createTeam({
			teamData: {
				name: 'Test Team',
				ownerId: user.id,
				companyId: company.id
			}
		})
		const result = await service.findTeamOrFail({ filter: { name: team.name } })

		expect(result).toBeDefined()
		expect(result.name).toBe(team.name)
	})

	it('should update a team', async () => {
		const service = container.resolve(TeamService)
		const userService = container.resolve(UserService)
		const companyService = container.resolve(CompanyService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await companyService.createCompany({
			data: companyInput
		})

		const team = await service.createTeam({
			teamData: {
				name: 'Test Team',
				ownerId: user.id,
				companyId: company.id
			}
		})
		const result = await service.updateTeam({
			filter: { name: team.name },
			data: { name: 'New Team' }
		})

		expect(result).toBeDefined()
		expect(result?.name).toBe('New Team')
	})
})
