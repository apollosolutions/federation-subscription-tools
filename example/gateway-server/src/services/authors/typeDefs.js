import { gql } from "apollo-server";

export const typeDefs = gql`
  type Author @key(fields: "id") {
    id: ID!
    name: String!
    # nomDePlum: String
  }

  extend type Query {
    author(id: ID!): Author
    authors: [Author]
  }
`;
