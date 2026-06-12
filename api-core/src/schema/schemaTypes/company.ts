import gql from 'graphql-tag'

export const Company = gql`
	# extend type Query {
	# }

	# extend type Mutation {

	# }

	type Company {
		id: ID!
		name: String!
	}
`
