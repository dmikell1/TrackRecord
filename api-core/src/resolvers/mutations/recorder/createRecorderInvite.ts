import type { Context } from '@packages/types'
import type { RecorderInviteInterface } from '@packages/types/recorderInvite'

interface CreateRecorderInviteArgs {
	data: {
		team: string
		email: string
	}
}

export const createRecorderInvite = async (
	_parent: unknown,
	{ data }: CreateRecorderInviteArgs,
	{ recorderInviteService, reportingService }: Context
): Promise<{ invite: RecorderInviteInterface; emailSent: boolean }> => {
	reportingService.startTrace({
		op: 'createRecorderInvite',
		name: 'createRecorderInvite'
	})
	try {
		return await recorderInviteService.createRecorderInvite({
			teamId: data.team,
			email: data.email
		})
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
