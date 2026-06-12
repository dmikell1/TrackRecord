import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { UserStatus } from '@packages/enums'
import { UserRepository } from '@packages/repositories/user/UserRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'

import { buildMockUser } from '@builders/user'

// ------------------------------------------------------------------
// Test suite
// ------------------------------------------------------------------

describe('UserService', () => {
	let userService: UserService
	let mockUserRepository: jest.Mocked<UserRepository>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockUserRepository = mock<UserRepository>()
		mockReportingService = mock<ReportingService>()

		// The @ReportErrors() decorator calls reportingService.withTrace({ fn }).
		// Without a real implementation, fn() is never invoked and methods return
		// undefined.  Wire the mock to pass-through so all test logic executes.
		mockReportingService.withTrace.mockImplementation(({ fn }) => fn())

		container.registerInstance(UserRepository, mockUserRepository)
		container.registerInstance(ReportingService, mockReportingService)

		userService = container.resolve(UserService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	// ------------------------------------------------------------------
	describe('getUserById', () => {
		it('returns user when found', async () => {
			const mockUser = buildMockUser()
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			const result = await userService.getUserById({ id: 'user-123' })

			expect(result).toEqual(mockUser)
			expect(mockUserRepository.findOne).toHaveBeenCalledWith({
				filter: { id: 'user-123' }
			})
		})

		it('throws and reports error when user not found', async () => {
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(
				userService.getUserById({ id: 'not-found' })
			).rejects.toThrow('User not found with id: not-found')

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	// ------------------------------------------------------------------
	describe('getUserByClerkId', () => {
		it('returns user when found by clerkId', async () => {
			const mockUser = buildMockUser({ clerkId: 'clerk-abc' })
			mockUserRepository.findByClerkId.mockResolvedValue(mockUser)

			const result = await userService.getUserByClerkId({ clerkId: 'clerk-abc' })

			expect(result).toEqual(mockUser)
			expect(mockUserRepository.findByClerkId).toHaveBeenCalledWith({
				clerkId: 'clerk-abc'
			})
		})

		it('returns null when clerkId not found', async () => {
			mockUserRepository.findByClerkId.mockResolvedValue(null)

			const result = await userService.getUserByClerkId({ clerkId: 'unknown' })

			expect(result).toBeNull()
		})
	})

	// ------------------------------------------------------------------
	describe('syncUserFromClerk', () => {
		it('updates all provided fields for an existing user', async () => {
			const existingUser = buildMockUser({ clerkId: 'clerk-abc', email: 'old@example.com' })
			const updatedUser = buildMockUser({
				clerkId: 'clerk-abc',
				firstName: 'Jane',
				email: 'new@example.com'
			})

			mockUserRepository.findByClerkId.mockResolvedValue(existingUser)
			mockUserRepository.update.mockResolvedValue(updatedUser)

			const result = await userService.syncUserFromClerk({
				clerkId: 'clerk-abc',
				userData: {
					firstName: 'Jane',
					email: 'new@example.com'
				}
			})

			expect(result).toEqual(updatedUser)
			expect(mockUserRepository.update).toHaveBeenCalledWith({
				filter: { clerkId: 'clerk-abc' },
				data: { firstName: 'Jane', email: 'new@example.com' }
			})
		})

		it('only passes defined fields to the update', async () => {
			const existingUser = buildMockUser({ clerkId: 'clerk-abc' })
			const updatedUser = buildMockUser({ clerkId: 'clerk-abc', firstName: 'Jane' })

			mockUserRepository.findByClerkId.mockResolvedValue(existingUser)
			mockUserRepository.update.mockResolvedValue(updatedUser)

			await userService.syncUserFromClerk({
				clerkId: 'clerk-abc',
				userData: { firstName: 'Jane' }
			})

			expect(mockUserRepository.update).toHaveBeenCalledWith({
				filter: { clerkId: 'clerk-abc' },
				data: { firstName: 'Jane' }
			})
		})

		it('throws and reports when user not found for clerkId', async () => {
			mockUserRepository.findByClerkId.mockResolvedValue(null)

			await expect(
				userService.syncUserFromClerk({
					clerkId: 'unknown',
					userData: { firstName: 'X' }
				})
			).rejects.toThrow('User not found with clerkId: unknown')

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	// ------------------------------------------------------------------
	describe('updateUser', () => {
		it('returns updated user on success', async () => {
			const updatedUser = buildMockUser({ firstName: 'Updated' })
			mockUserRepository.update.mockResolvedValue(updatedUser)

			const result = await userService.updateUser({
				filter: { id: 'user-123' },
				data: { firstName: 'Updated' }
			})

			expect(result).toEqual(updatedUser)
			expect(mockUserRepository.update).toHaveBeenCalledWith({
				filter: { id: 'user-123' },
				data: { firstName: 'Updated' }
			})
		})

		it('reports and rethrows on repository error', async () => {
			const error = new Error('DB write failed')
			mockUserRepository.update.mockRejectedValue(error)

			await expect(
				userService.updateUser({
					filter: { id: 'user-123' },
					data: { firstName: 'X' }
				})
			).rejects.toThrow('DB write failed')

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	// ------------------------------------------------------------------
	describe('findUser', () => {
		it('returns matching user', async () => {
			const mockUser = buildMockUser()
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			const result = await userService.findUser({
				filter: { email: 'john@example.com' }
			})

			expect(result).toEqual(mockUser)
			expect(mockUserRepository.findOne).toHaveBeenCalledWith({
				filter: { email: 'john@example.com' },
				relations: undefined
			})
		})

		it('returns null when no match', async () => {
			mockUserRepository.findOne.mockResolvedValue(null)

			const result = await userService.findUser({
				filter: { email: 'ghost@example.com' }
			})

			expect(result).toBeNull()
		})
	})

	// ------------------------------------------------------------------
	describe('findUserOrFail', () => {
		it('returns user when found', async () => {
			const mockUser = buildMockUser()
			mockUserRepository.findOne.mockResolvedValue(mockUser)

			const result = await userService.findUserOrFail({
				filter: { id: 'user-123' }
			})

			expect(result).toEqual(mockUser)
		})

		it('throws and reports when not found', async () => {
			mockUserRepository.findOne.mockResolvedValue(null)

			await expect(
				userService.findUserOrFail({ filter: { email: 'missing@example.com' } })
			).rejects.toThrow()

			expect(mockReportingService.reportError).toHaveBeenCalled()
		})
	})

	// ------------------------------------------------------------------
	describe('createUser', () => {
		it('passes mapped fields to repository.create', async () => {
			const newUser = buildMockUser({ status: UserStatus.Pending, clerkId: 'clerk-new' })
			mockUserRepository.create.mockResolvedValue(newUser)

			const result = await userService.createUser({
				userData: {
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					avatar: 'https://example.com/avatar.jpg',
					clerkId: 'clerk-new',
					termsAndConditions: true
				}
			})

			expect(result).toEqual(newUser)
			expect(mockUserRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					avatar: 'https://example.com/avatar.jpg',
					status: UserStatus.Pending,
					clerkId: 'clerk-new'
				})
			})
		})

		it('defaults status to Pending when none is provided', async () => {
			const newUser = buildMockUser({ status: UserStatus.Pending })
			mockUserRepository.create.mockResolvedValue(newUser)

			await userService.createUser({
				userData: {
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					avatar: 'avatar.jpg',
					termsAndConditions: true
				}
			})

			expect(mockUserRepository.create).toHaveBeenCalledWith({
				data: expect.objectContaining({ status: UserStatus.Pending })
			})
		})
	})

	// ------------------------------------------------------------------
	describe('deleteUser', () => {
		it('returns true when the record is deleted', async () => {
			mockUserRepository.delete.mockResolvedValue(true)

			const result = await userService.deleteUser({ filter: { id: 'user-123' } })

			expect(result).toBe(true)
			expect(mockUserRepository.delete).toHaveBeenCalledWith({
				filter: { id: 'user-123' }
			})
		})
	})

	// ------------------------------------------------------------------
	describe('countUsers', () => {
		it('returns the count from repository', async () => {
			mockUserRepository.count.mockResolvedValue(7)

			const result = await userService.countUsers({ filter: {} })

			expect(result).toBe(7)
			expect(mockUserRepository.count).toHaveBeenCalledWith({ filter: {} })
		})
	})
})
