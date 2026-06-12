const ATHLETE_COLORS = [
	'#EF4444',
	'#F97316',
	'#EAB308',
	'#22C55E',
	'#3B82F6',
	'#8B5CF6',
	'#EC4899',
	'#14B8A6'
] as const

export const pickRandomAthleteColor = (): string => {
	const index = Math.floor(Math.random() * ATHLETE_COLORS.length)
	return ATHLETE_COLORS[index] ?? ATHLETE_COLORS[0]
}
