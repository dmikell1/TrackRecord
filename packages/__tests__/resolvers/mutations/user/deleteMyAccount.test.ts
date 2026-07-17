import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { deleteMyAccount } from '@api-core/src/resolvers/mutations/user/deleteMyAccount'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { UserService } from '@packages/services/user/UserService'
import type { Context } from '@packages/types'

describe('deleteMyAccount resolver', () => {
	let mockUserService: jest.Mocked<UserService>
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockUserService = mock<UserService>()
		mockReportingService = mock<ReportingService>()
		container.registerInstance(UserService, mockUserService)
	})

	afterEach(() => {
		container.clearInstances()
	})

	it('deletes the authenticated user account', async () => {
		mockUserService.deleteMyAccount.mockResolvedValue(true)
		const context = {
			req: { session: { userId: 'user-1' } },
			reportingService: mockReportingService
		} as unknown as Context

		const result = await deleteMyAccount(null, {}, context)

		expect(result).toBe(true)
		expect(mockUserService.deleteMyAccount).toHaveBeenCalledWith({
			userId: 'user-1'
		})
	})

	it('throws when user is not authenticated', async () => {
		const context = {
			req: { session: {} },
			reportingService: mockReportingService
		} as unknown as Context

		await expect(deleteMyAccount(null, {}, context)).rejects.toThrow(
			'User not authenticated'
		)
		expect(mockUserService.deleteMyAccount).not.toHaveBeenCalled()
	})
})
