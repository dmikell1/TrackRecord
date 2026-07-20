import { Resend } from 'resend'
import { inject, injectable, singleton } from 'tsyringe'

import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { isDevelopment } from '@packages/utils/isDevelopment'
import { env } from '@packages/utils/validateEnvs'

const isResendConfigured = (): boolean => {
	return (
		env.RESEND_API_KEY.length > 0 &&
		!env.RESEND_API_KEY.startsWith('re_placeholder')
	)
}

@injectable()
@singleton()
@ReportErrors()
export class EmailService {
	private resend: Resend | null = null

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
		if (!isResendConfigured()) {
			if (isDevelopment) {
				this.reportingService.log({
					message:
						'Skipping email send in development (Resend not configured)',
					to,
					subject
				})
				return
			}

			throw new Error('Email service is not configured')
		}

		try {
			const client = this.getResendClient()
			const from = `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`

			const { error } = await client.emails.send({
				from,
				to: [to],
				subject,
				text,
				html,
				...(replyTo !== undefined && { replyTo })
			})

			if (error) {
				throw new Error(error.message)
			}
		} catch (error) {
			this.reportingService.error({
				message: 'Failed to send email',
				error: error as Error,
				to,
				subject
			})
			throw error
		}
	}

	@NoTrace()
	private getResendClient(): Resend {
		if (this.resend === null) {
			this.resend = new Resend(env.RESEND_API_KEY)
		}

		return this.resend
	}
}
