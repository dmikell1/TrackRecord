import gql from 'graphql-tag'

export const Team = gql`
	# extend type Query {
	# }

	# extend type Mutation {

	# }

	type Team {
		id: ID!
		name: String!
	}
`
