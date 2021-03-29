import { gql } from "@apollo/client";

import { PostFields } from "./fragments";

export const PostAdded = gql`
  subscription PostAdded {
    postAdded {
      ...PostFields
    }
  }
  ${PostFields}
`;
