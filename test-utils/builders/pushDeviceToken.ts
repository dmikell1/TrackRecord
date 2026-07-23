import { randomUUID } from 'crypto'

import Chance from 'chance'

import { PushPlatform } from '@packages/enums/push'
import type { PushDeviceTokenInterface } from '@packages/types/pushDeviceToken'

const chance = new Chance(String(process.env.CHANCE_SEED))

export const buildMockPushDeviceToken = (
	overrides: Partial<PushDeviceTokenInterface> = {}
): PushDeviceTokenInterface => ({
	id: overrides.id ?? randomUUID(),
	userId: overrides.userId ?? randomUUID(),
	token: overrides.token ?? `ExponentPushToken[${chance.string({ length: 22 })}]`,
	platform: overrides.platform ?? PushPlatform.Ios,
	createdAt: overrides.createdAt ?? new Date(),
	updatedAt: overrides.updatedAt ?? new Date()
})
