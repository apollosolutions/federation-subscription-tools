import { ApolloServer } from "apollo-server";
import { buildSubgraphSchema } from "@apollo/subgraph";

import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

const schema = buildSubgraphSchema([{ typeDefs, resolvers }]);

const server = new ApolloServer({ schema });

server.listen(process.env.AUTHORS_SERVICE_PORT).then(({ url }) => {
  console.log(`🚀 Authors service ready at ${url}`);
});
