// import Bull, { Job } from 'bull'
// import { container } from 'tsyringe'

// import { EmailService } from '@packages/services/email/EmailService'
// import { ReportingService } from '@packages/services/logging/ReportingService'
// import { SendEmailQueueProps } from '@packages/services/queue/types'

// export const sendEmailQueueProcessor = async (
// 	job: Job<SendEmailQueueProps>,
// 	done: Bull.DoneCallback
// ): Promise<void> => {
// 	const reportingService = container.resolve(ReportingService)
// 	const emailService = container.resolve(EmailService)

// 	reportingService.startTrace({
// 		op: 'queue',
// 		name: 'process_send_email_queue'
// 	})

// 	try {
// 		const { to, subject, text, html, replyTo } = job.data

// 		reportingService.log({
// 			message: 'Processing send email queue job',
// 			to,
// 			subject
// 		})

// 		await emailService.sendEmail({ to, subject, text, html, replyTo })

// 		done()
// 	} catch (error) {
// 		reportingService.reportError({ error: error as Error })
// 		done(error as Error)
// 	} finally {
// 		reportingService.endTrace()
// 	}
// }

// export default sendEmailQueueProcessor

const sendEmailQueueProcessor = async (): Promise<void> => {}

export default sendEmailQueueProcessor
