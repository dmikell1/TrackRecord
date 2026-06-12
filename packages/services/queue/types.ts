export interface SendEmailQueueProps {
	to: string
	subject: string
	text: string
	html: string
	replyTo?: string
}
