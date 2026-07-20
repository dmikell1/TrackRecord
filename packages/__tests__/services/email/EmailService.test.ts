import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { EmailService } from '@packages/services/email/EmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'

const mockSend = jest.fn()

jest.mock('resend', () => ({
	Resend: jest.fn().mockImplementation(() => ({
		emails: {
			send: mockSend
		}
	}))
}))

jest.mock('@packages/utils/isDevelopment', () => ({
	isDevelopment: true,
	isProduction: false
}))

describe('EmailService', () => {
	let service: EmailService
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockReportingService = mock<ReportingService>()
		container.registerInstance(ReportingService, mockReportingService)
		service = container.resolve(EmailService)
		mockSend.mockReset()
	})

	afterEach(() => {
		container.clearInstances()
		jest.resetModules()
	})

	describe('sendEmail', () => {
		it('skips sending in development when Resend is not configured', async () => {
			await service.sendEmail({
				to: 'runner@example.com',
				subject: 'Test',
				text: 'Hello',
				html: '<p>Hello</p>'
			})

			expect(mockSend).not.toHaveBeenCalled()
			expect(mockReportingService.log).toHaveBeenCalled()
		})
	})
})
