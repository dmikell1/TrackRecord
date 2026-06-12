import axios from 'axios'
import { mock } from 'jest-mock-extended'
import { container } from 'tsyringe'

import { EmailService } from '@packages/services/email/EmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'

jest.mock('axios')
jest.mock('@packages/utils/isDevelopment', () => ({
	isDevelopment: true,
	isProduction: false
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('EmailService', () => {
	let service: EmailService
	let mockReportingService: jest.Mocked<ReportingService>

	beforeEach(() => {
		mockReportingService = mock<ReportingService>()
		container.registerInstance(ReportingService, mockReportingService)
		service = container.resolve(EmailService)
		mockedAxios.post.mockReset()
	})

	afterEach(() => {
		container.clearInstances()
		jest.resetModules()
	})

	describe('sendEmail', () => {
		it('skips sending in development when SendGrid is not configured', async () => {
			await service.sendEmail({
				to: 'runner@example.com',
				subject: 'Test',
				text: 'Hello',
				html: '<p>Hello</p>'
			})

			expect(mockedAxios.post).not.toHaveBeenCalled()
		})
	})
})
