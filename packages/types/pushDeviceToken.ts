import type { PushPlatform } from '@packages/enums/push'

export interface PushDeviceTokenInterface {
	id: string
	userId: string
	token: string
	platform: PushPlatform
	createdAt: Date
	updatedAt: Date
}
