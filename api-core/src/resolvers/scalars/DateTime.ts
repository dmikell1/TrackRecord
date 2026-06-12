import { GraphQLScalarType, Kind } from 'graphql'

export const DateTime = new GraphQLScalarType({
	name: 'DateTime',
	description: 'DateTime scalar type',
	serialize(value: unknown): string {
		if (value instanceof Date) {
			return value.toISOString()
		}
		if (typeof value === 'string') {
			return value
		}
		throw new Error('DateTime can only serialize Date or string values')
	},
	parseValue(value: unknown): Date {
		if (typeof value === 'string') {
			return new Date(value)
		}
		if (value instanceof Date) {
			return value
		}
		throw new Error('DateTime can only parse string or Date values')
	},
	parseLiteral(ast): Date {
		if (ast.kind === Kind.STRING) {
			return new Date(ast.value)
		}
		throw new Error('DateTime can only parse string literals')
	}
})
