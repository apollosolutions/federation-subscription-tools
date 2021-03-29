import { ApolloServer } from "apollo-server";
import { buildFederatedSchema } from "@apollo/federation";

import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

const schema = buildFederatedSchema([{ typeDefs, resolvers }]);

const server = new ApolloServer({ schema });

server.listen(process.env.POSTS_SERVICE_PORT).then(({ url }) => {
  console.log(`🚀 Posts service ready at ${url}`);
});
