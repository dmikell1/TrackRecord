import type { Context } from '@packages/types'
import type { JoinInfoInterface } from '@packages/types/join'

interface JoinInfoArgs {
	token: string
}

export const joinInfo = async (
	_parent: unknown,
	args: JoinInfoArgs,
	{ athleteInviteService, recorderInviteService, reportingService }: Context
): Promise<JoinInfoInterface | null> => {
	reportingService.startTrace({ op: 'joinInfo', name: 'joinInfo' })
	try {
		const recorderJoin = await recorderInviteService.resolveJoinInfo({
			token: args.token
		})
		if (recorderJoin) {
			return recorderJoin
		}
		return await athleteInviteService.resolveJoinInfo({ token: args.token })
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
