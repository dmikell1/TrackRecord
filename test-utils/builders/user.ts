import { randomUUID } from 'crypto'

import Chance from 'chance'

import { UserStatus } from '@packages/enums'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'
import { UserInterface } from '@packages/types'

const chance = new Chance(String(process.env.CHANCE_SEED))

/**
 * Builds a complete UserInterface entity as it would be returned from the
 * database. Use in unit tests where the repository is mocked and you need a
 * ready-made entity object.
 *
 * For integration tests that write to a real database, use setupTestUser().
 */
export const buildMockUser = (
	overrides: Partial<UserInterface> = {}
): UserInterface => ({
	id: randomUUID(),
	firstName: 'John',
	lastName: 'Doe',
	email: 'john@example.com',
	avatar: 'https://example.com/avatar.jpg',
	status: UserStatus.Active,
	clerkId: null,
	invitedById: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})

export interface MockUserInput {
	firstName: string
	lastName: string
	email: string
	avatar: string
	status: UserStatus
	termsAndConditions: boolean
	clerkId?: string | null
}

export const createMockUserData = (
	overrides: Partial<MockUserInput> = {}
): MockUserInput => {
	const timestamp = Date.now()
	const randomNum = chance.integer({ min: 1000, max: 9999 })
	return {
		firstName: chance.first(),
		lastName: chance.last(),
		email: `test${timestamp}${randomNum}@example.com`.toLowerCase(),
		clerkId: `clerk_${timestamp}_${randomNum}`,
		avatar: chance.avatar(),
		status: chance.pickone([UserStatus.Active, UserStatus.Pending]),
		termsAndConditions: true,
		...overrides
	}
}

export const createMockUserRepository = (): jest.Mocked<UserRepository> =>
	({
		create: jest.fn(),
		findOne: jest.fn(),
		findOneOrFail: jest.fn(),
		find: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn(),
		findByEmail: jest.fn(),
		findByClerkId: jest.fn()
	}) as unknown as jest.Mocked<UserRepository>

export const createMockUserService = (): jest.Mocked<UserService> =>
	({
		createUser: jest.fn(),
		findUser: jest.fn(),
		findUsers: jest.fn(),
		findUserOrFail: jest.fn(),
		updateUser: jest.fn(),
		deleteUser: jest.fn(),
		countUsers: jest.fn(),
		getUserById: jest.fn(),
		getUserByClerkId: jest.fn(),
		syncUserFromClerk: jest.fn()
	}) as unknown as jest.Mocked<UserService>

const createMockReportingService = (): jest.Mocked<ReportingService> =>
	({
		reportError: jest.fn()
	}) as unknown as jest.Mocked<ReportingService>

export const createTestUserService = (): UserService => {
	const mockUserRepository = createMockUserRepository()
	return new UserService(mockUserRepository, createMockReportingService())
}

export const setupTestUser = async ({
	userRepository,
	overrides = {}
}: {
	userRepository: UserRepository
	overrides?: Partial<MockUserInput>
}): Promise<UserInterface> => {
	const raw = createMockUserData(overrides)
	const { termsAndConditions: _terms, ...rest } = raw
	return userRepository.create({
		data: {
			firstName: rest.firstName,
			lastName: rest.lastName,
			email: rest.email,
			avatar: rest.avatar,
			status: rest.status,
			...(rest.clerkId !== undefined &&
				rest.clerkId !== null && { clerkId: rest.clerkId })
		}
	})
}
