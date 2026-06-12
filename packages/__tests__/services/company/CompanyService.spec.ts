import { CompanyService } from '@packages/services/company/CompanyService'
import { UserService } from '@packages/services/user/UserService'
import { container } from 'tsyringe'

import { createMockCompanyInput } from '@test-utils/builders/company'
import { createMockUserData } from '@test-utils/builders/user'
import {
	connectIntegrationTestDb,
	disconnectIntegrationTestDb,
	resetIntegrationTestDb
} from '@test-utils/jest/dbTestHooks'

describe('CompanyService', () => {
	beforeAll(async () => {
		await connectIntegrationTestDb()
	})

	afterAll(async () => {
		await disconnectIntegrationTestDb()
	})

	beforeEach(async () => {
		await resetIntegrationTestDb()
	})

	it('should create a new company', async () => {
		const service = container.resolve(CompanyService)
		const userService = container.resolve(UserService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await service.createCompany({ data: companyInput })

		expect(company).toBeDefined()
		expect(company?.name).toBe(companyInput.name)
	})

	it('should find a company by name', async () => {
		const service = container.resolve(CompanyService)
		const userService = container.resolve(UserService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await service.createCompany({ data: companyInput })
		const result = await service.findCompany({
			filter: { name: company?.name }
		})

		expect(result).toBeDefined()
		expect(result?.name).toBe(company.name)
	})

	it('should find all companies', async () => {
		const service = container.resolve(CompanyService)
		const userService = container.resolve(UserService)

		const userData1 = createMockUserData()
		const userData2 = createMockUserData()
		const user1 = await userService.createUser({ userData: userData1 })
		const user2 = await userService.createUser({ userData: userData2 })

		const input1 = createMockCompanyInput({ ownerId: user1.id })
		const input2 = createMockCompanyInput({ ownerId: user2.id })

		await service.createCompany({ data: input1 })
		await service.createCompany({ data: input2 })

		const result = await service.findCompanies({ filter: {} })

		expect(result).toBeDefined()
		expect(result.length).toBe(2)
	})

	it('should throw an error if company is not found', async () => {
		const service = container.resolve(CompanyService)

		await expect(
			service.findCompanyOrFail({ filter: { name: 'invalid-name-xyz' } })
		).rejects.toThrow()
	})

	it('should find a company or throw an error', async () => {
		const service = container.resolve(CompanyService)
		const userService = container.resolve(UserService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await service.createCompany({ data: companyInput })
		const result = await service.findCompanyOrFail({
			filter: { name: company.name }
		})

		expect(result).toBeDefined()
		expect(result.name).toBe(company.name)
	})

	it('should update a company', async () => {
		const service = container.resolve(CompanyService)
		const userService = container.resolve(UserService)

		const userData = createMockUserData()
		const user = await userService.createUser({ userData })

		const companyInput = createMockCompanyInput({ ownerId: user.id })
		const { company } = await service.createCompany({ data: companyInput })
		const result = await service.updateCompany({
			filter: { name: company.name },
			data: { settings: { timezoneName: 'America/New_York' } }
		})

		expect(result).toBeDefined()
		expect(result?.settings.timezoneName).toBe('America/New_York')
	})
})
