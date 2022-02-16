import { createHash } from "crypto";

import { makeExecutableSchema } from "graphql-tools";
import { gql } from 'graphql-tag';
import { DocumentNode, printSchema } from "graphql";

export function getGatewayApolloConfig(key: any, graphVariant: any) {
  return {
    key,
    graphId: key.split(":")[1],
    graphVariant,
    keyHash: createHash("sha512").update(key).digest("hex")
  };
}

export function makeSubscriptionSchema({ gatewaySchema, typeDefs, resolvers }: any) {
  if (!typeDefs || !resolvers) {
    throw new Error(
      "Both `typeDefs` and `resolvers` are required to make the executable subscriptions schema."
    );
  }

  const gatewayTypeDefs = gatewaySchema
    ? gql(printSchema(gatewaySchema))
    : undefined;

  return makeExecutableSchema({
    typeDefs: [...(gatewayTypeDefs && [gatewayTypeDefs]) as DocumentNode[], typeDefs],
    resolvers
  });
}

