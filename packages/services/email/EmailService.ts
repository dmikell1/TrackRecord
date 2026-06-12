import axios from 'axios'
import { injectable, inject, singleton } from 'tsyringe'

import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { env } from '@packages/utils/validateEnvs'
import { isDevelopment } from '@packages/utils/isDevelopment'

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send'

const isSendGridConfigured = (): boolean => {
	return (
		env.SENDGRID_KEY.length > 0 && env.SENDGRID_KEY !== 'SG.SENDGRID_KEY'
	)
}

@injectable()
@singleton()
@ReportErrors()
export class EmailService {
	constructor(
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async sendEmail({
		to,
		subject,
		text,
		html,
		replyTo
	}: {
		to: string
		subject: string
		text: string
		html: string
		replyTo?: string
	}): Promise<void> {
		if (!isSendGridConfigured()) {
			if (isDevelopment) {
				this.reportingService.log({
					message: 'Skipping email send in development (SendGrid not configured)',
					to,
					subject
				})
				return
			}

			throw new Error('Email service is not configured')
		}

		try {
			await axios.post(
				SENDGRID_API_URL,
				{
					personalizations: [{ to: [{ email: to }] }],
					from: {
						email: env.SENDGRID_FROM_EMAIL,
						name: env.SENDGRID_FROM_NAME
					},
					...(replyTo !== undefined && {
						reply_to: { email: replyTo }
					}),
					subject,
					content: [
						{ type: 'text/plain', value: text },
						{ type: 'text/html', value: html }
					]
				},
				{
					headers: {
						Authorization: `Bearer ${env.SENDGRID_KEY}`,
						'Content-Type': 'application/json'
					}
				}
			)
		} catch (error) {
			this.reportingService.error('Failed to send email', {
				error,
				to,
				subject
			})
			throw error
		}
	}
}
