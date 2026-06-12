import type { Context } from '@packages/types'
import type { AthleteInterface } from '@packages/types/athlete'

interface AcceptAthleteInviteArgs {
	token: string
}

export const acceptAthleteInvite = async (
	_parent: unknown,
	{ token }: AcceptAthleteInviteArgs,
	{ req, athleteInviteService, reportingService }: Context
): Promise<AthleteInterface> => {
	reportingService.startTrace({ op: 'acceptAthleteInvite', name: 'acceptAthleteInvite' })
	try {
		if (req.session.userId) {
			return await athleteInviteService.acceptJoin({
				token,
				userId: req.session.userId
			})
		}

		if (req.session.clerkId) {
			const athlete = await athleteInviteService.completeAthleteInviteSignup({
				token,
				clerkId: req.session.clerkId
			})

			if (athlete.userId) {
				req.session.userId = athlete.userId
			}

			return athlete
		}

		throw new Error('You must be signed in to accept an invite')
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
