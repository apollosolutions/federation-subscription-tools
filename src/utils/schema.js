const { createHash } = require("crypto");
const { gql, makeExecutableSchema } = require("apollo-server");
const { printSchema } = require("graphql");

function getGatewayApolloConfig(key, graphVariant) {
  return {
    key,
    graphId: key.split(":")[1],
    graphVariant,
    keyHash: createHash("sha512").update(key).digest("hex")
  };
}

function makeSubscriptionSchema({ gatewaySchema, typeDefs, resolvers }) {
  if (!typeDefs || !resolvers) {
    throw new Error(
      "Both `typeDefs` and `resolvers` are required to make the executable subscriptions schema."
    );
  }

  const gatewayTypeDefs = gatewaySchema
    ? gql(printSchema(gatewaySchema))
    : undefined;

  return makeExecutableSchema({
    typeDefs: [...(gatewayTypeDefs && [gatewayTypeDefs]), typeDefs],
    resolvers
  });
}

module.exports = {
  getGatewayApolloConfig,
  makeSubscriptionSchema
};
