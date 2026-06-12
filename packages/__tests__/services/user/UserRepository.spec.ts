import { UserService } from '@packages/services/user/UserService'
import { container } from 'tsyringe'

import { createMockUserData } from '@test-utils/builders/user'
import {
	connectIntegrationTestDb,
	disconnectIntegrationTestDb,
	resetIntegrationTestDb
} from '@test-utils/jest/dbTestHooks'

describe('UserService', () => {
	beforeAll(async () => {
		await connectIntegrationTestDb()
	})

	afterAll(async () => {
		await disconnectIntegrationTestDb()
	})

	beforeEach(async () => {
		await resetIntegrationTestDb()
	})

	it('should create a new user', async () => {
		const service = container.resolve(UserService)
		const testUserData = createMockUserData()

		const result = await service.createUser({ userData: testUserData })

		expect(result).toBeDefined()
		expect(result?.email).toBe(testUserData.email)
	})

	it('should find a user', async () => {
		const service = container.resolve(UserService)
		const testUserData = createMockUserData()

		const user = await service.createUser({ userData: testUserData })
		const result = await service.findUser({ filter: { email: user.email } })

		expect(result).toBeDefined()
		expect(result?.email).toBe(user.email)
	})

	it('should find all users', async () => {
		const service = container.resolve(UserService)
		const testUserData = createMockUserData()
		const testUserData2 = createMockUserData()

		await service.createUser({ userData: testUserData })
		await service.createUser({ userData: testUserData2 })

		const result = await service.findUsers({ filter: {} })

		expect(result).toBeDefined()
		expect(result.length).toBe(2)
	})

	it('should throw an error if user is not found', async () => {
		const service = container.resolve(UserService)

		await expect(
			service.findUserOrFail({ filter: { email: 'invalid-email@test.invalid' } })
		).rejects.toThrow()
	})

	it('should find a user or throw an error', async () => {
		const service = container.resolve(UserService)
		const testUserData = createMockUserData()

		const user = await service.createUser({ userData: testUserData })
		const result = await service.findUserOrFail({
			filter: { email: user.email }
		})

		expect(result).toBeDefined()
		expect(result.email).toBe(user.email)
	})

	it('should update a user', async () => {
		const service = container.resolve(UserService)
		const testUserData = createMockUserData()

		const user = await service.createUser({ userData: testUserData })
		const result = await service.updateUser({
			filter: { email: user.email },
			data: { firstName: 'new-name' }
		})

		expect(result).toBeDefined()
		expect(result?.firstName).toBe('new-name')
	})
})
