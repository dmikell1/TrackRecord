import { inject, injectable, singleton } from 'tsyringe'

import { PushPlatform } from '@packages/enums/push'
import { PushDeviceTokenRepository } from '@packages/repositories/push/PushDeviceTokenRepository'
import ReportErrors, {
	NoTrace
} from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { PushDeviceTokenInterface } from '@packages/types/pushDeviceToken'
import { env } from '@packages/utils/validateEnvs'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

type ExpoPushTicket =
	| { status: 'ok'; id: string }
	| {
			status: 'error'
			message: string
			details?: { error?: string }
	  }

@injectable()
@singleton()
@ReportErrors()
export class PushNotificationService {
	constructor(
		@inject(PushDeviceTokenRepository)
		private pushDeviceTokenRepository: PushDeviceTokenRepository,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async registerToken({
		userId,
		token,
		platform
	}: {
		userId: string
		token: string
		platform: PushPlatform
	}): Promise<PushDeviceTokenInterface> {
		const trimmedToken = token.trim()
		if (trimmedToken.length === 0) {
			throw new Error('Push token is required')
		}

		return await this.pushDeviceTokenRepository.upsertToken({
			data: {
				userId,
				token: trimmedToken,
				platform
			}
		})
	}

	public async unregisterToken({
		userId,
		token
	}: {
		userId: string
		token: string
	}): Promise<boolean> {
		return await this.pushDeviceTokenRepository.deleteByUserAndToken({
			userId,
			token: token.trim()
		})
	}

	public async sendToUser({
		userId,
		title,
		body,
		data
	}: {
		userId: string
		title: string
		body: string
		data?: Record<string, string>
	}): Promise<void> {
		const devices = await this.pushDeviceTokenRepository.findByUserId({
			userId
		})

		if (devices.length === 0) {
			return
		}

		const messages = devices.map((device) => ({
			to: device.token,
			sound: 'default' as const,
			title,
			body,
			data: data ?? {}
		}))

		const tickets = await this.sendExpoPush({ messages })
		const invalidTokens: string[] = []

		tickets.forEach((ticket, index) => {
			if (ticket.status !== 'error') {
				return
			}

			const errorCode = ticket.details?.error
			if (
				errorCode === 'DeviceNotRegistered' ||
				errorCode === 'InvalidCredentials'
			) {
				const token = devices[index]?.token
				if (token) {
					invalidTokens.push(token)
				}
			} else {
				this.reportingService.reportError({
					error: new Error(
						`Expo push failed: ${ticket.message}${errorCode ? ` (${errorCode})` : ''}`
					)
				})
			}
		})

		if (invalidTokens.length > 0) {
			await this.pushDeviceTokenRepository.deleteByTokens({
				tokens: invalidTokens
			})
		}
	}

	@NoTrace()
	private buildPushHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Accept-Encoding': 'gzip, deflate',
			'Content-Type': 'application/json'
		}

		if (env.EXPO_ACCESS_TOKEN.length > 0) {
			headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`
		}

		return headers
	}

	private async sendExpoPush({
		messages
	}: {
		messages: Array<{
			to: string
			sound: 'default'
			title: string
			body: string
			data: Record<string, string>
		}>
	}): Promise<ExpoPushTicket[]> {
		const response = await fetch(EXPO_PUSH_URL, {
			method: 'POST',
			headers: this.buildPushHeaders(),
			body: JSON.stringify(messages)
		})

		if (!response.ok) {
			const responseText = await response.text()
			throw new Error(
				`Expo push request failed (${response.status}): ${responseText}`
			)
		}

		const payload = (await response.json()) as {
			data?: ExpoPushTicket | ExpoPushTicket[]
		}

		if (Array.isArray(payload.data)) {
			return payload.data
		}

		if (payload.data) {
			return [payload.data]
		}

		return []
	}
}
