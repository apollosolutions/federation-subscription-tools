import { gql } from "@apollo/client";

export const PostFields = gql`
  fragment PostFields on Post {
    author {
      id
      name
    }
    content
    id
    publishedAt
    title
  }
`;
