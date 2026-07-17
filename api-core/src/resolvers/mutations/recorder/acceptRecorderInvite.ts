import type { Context } from '@packages/types'

interface AcceptRecorderInviteArgs {
	token: string
}

export const acceptRecorderInvite = async (
	_parent: unknown,
	{ token }: AcceptRecorderInviteArgs,
	{ req, recorderInviteService, reportingService }: Context
): Promise<boolean> => {
	reportingService.startTrace({
		op: 'acceptRecorderInvite',
		name: 'acceptRecorderInvite'
	})
	try {
		if (req.session.userId) {
			return await recorderInviteService.acceptRecorderInvite({
				token,
				userId: req.session.userId
			})
		}

		if (req.session.clerkId) {
			const accepted =
				await recorderInviteService.completeRecorderInviteSignup({
					token,
					clerkId: req.session.clerkId
				})

			const invite = await recorderInviteService.findRecorderInvite({
				filter: { token }
			})
			if (invite?.acceptedByUserId) {
				req.session.userId = invite.acceptedByUserId
			}

			return accepted
		}

		throw new Error('You must be signed in to accept an invite')
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
