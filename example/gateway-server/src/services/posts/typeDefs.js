import { gql } from "apollo-server";

export const typeDefs = gql`
  type Post {
    id: ID!
    author: Author!
    content: String!
    publishedAt: String!
    title: String!
  }

  extend type Author @key(fields: "id") {
    id: ID! @external
    posts: [Post]
  }

  extend type Query {
    post(id: ID!): Post
    posts: [Post]
  }

  extend type Mutation {
    addPost(authorID: ID!, content: String, title: String): Post
  }
`;
