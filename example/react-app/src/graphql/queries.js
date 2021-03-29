import { gql } from "@apollo/client";

import { PostFields } from "./fragments";

export const GetPosts = gql`
  query GetPosts {
    posts {
      ...PostFields
    }
  }
  ${PostFields}
`;
