export const formatTrackEventLabel = ({
	event
}: {
	event: string | null | undefined
}): string => {
	if (event === null || event === undefined || event.length === 0) {
		return 'Video'
	}

	return event.replace(/([A-Z])/g, ' $1').trim()
}
