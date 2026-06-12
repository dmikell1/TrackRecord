import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

export const Athlete = {
	avatarUrl: async (
		parent: AthleteInterface,
		_args: unknown,
		{ userService }: Context
	): Promise<string | null> => {
		if (!parent.userId) {
			return null
		}

		const user = await userService.findUser({ filter: { id: parent.userId } })
		if (!user) {
			return null
		}

		const avatar = user.avatar?.trim()
		return avatar && avatar.length > 0 ? avatar : null
	}
}
