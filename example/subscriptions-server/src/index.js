import http from "http";

import {
  addGatewayDataSourceToSubscriptionContext,
  getGatewayApolloConfig,
  makeSubscriptionSchema
} from "federation-subscription-tools";
import { ApolloGateway } from "@apollo/gateway";
import {
  execute,
  getOperationAST,
  GraphQLError,
  parse,
  subscribe,
  validate
} from "graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import ws from "ws";

import { LiveBlogDataSource } from "./datasources/LiveBlogDataSource";
import { resolvers } from "./resolvers";
import { typeDefs } from "./typeDefs";

(async () => {
  const apolloKey = process.env.APOLLO_KEY;
  const graphRef = process.env.APOLLO_GRAPH_REF;
  const gatewayEndpoint = process.env.GATEWAY_ENDPOINT;
  const isProd = process.env.NODE_ENV === "production";
  const port = process.env.SUBSCRIPTIONS_SERVICE_PORT;

  let apolloConfig;
  let schema;

  /**
   * Instantiate an instance of the Gateway
   */
  let gatewayOptions = {
    debug: isProd ? false : true
  };

  if (!apolloKey) {
    gatewayOptions.serviceList = [
      { name: "authors", url: process.env.AUTHORS_SERVICE_URL },
      { name: "posts", url: process.env.POSTS_SERVICE_URL }
    ];
  }

  const gateway = new ApolloGateway(gatewayOptions);

  gateway.onSchemaLoadOrUpdate(schemaContext => {
    schema = makeSubscriptionSchema({
      gatewaySchema: schemaContext.apiSchema,
      typeDefs,
      resolvers
    });
  });

  if (apolloKey) {
    apolloConfig = getGatewayApolloConfig(apolloKey, graphRef);
  } else {
    // For unmanaged federation, we must set a poll interval to query the
    // subgraph services for their schemas to detect a schema change. Polling
    // the running endpoint for these SDLs is fairly blunt approach, so in
    // production, a more computationally efficient approach would be
    // preferable (or managed federation).
    gateway.experimental_pollInterval = 36000;
  }

  await gateway.load({ ...(apolloConfig && { apollo: apolloConfig }) });

  /**
   * Expose GraphQL endpoint via WebSockets (for subscription operations only)
   */
  const httpServer = http.createServer(function weServeSocketsOnly(_, res) {
    res.writeHead(404);
    res.end();
  });

  const wsServer = new ws.Server({
    server: httpServer,
    path: "/graphql"
  });

  useServer(
    {
      execute,
      subscribe,
      context: ctx => {
        // If a token was sent for auth purposes, retrieve it here
        const { token } = ctx.connectionParams;

        // Instantiate and initialize the GatewayDataSource subclass
        // (data source methods will be accessible on the `gatewayApi` key)
        const liveBlogDataSource = new LiveBlogDataSource(gatewayEndpoint);
        const dataSourceContext = addGatewayDataSourceToSubscriptionContext(
          ctx,
          liveBlogDataSource
        );

        // Return the complete context for the request
        return { token: token || null, ...dataSourceContext };
      },
      onSubscribe: (_ctx, msg) => {
        // Construct the execution arguments
        const args = {
          schema,
          operationName: msg.payload.operationName,
          document: parse(msg.payload.query),
          variableValues: msg.payload.variables
        };

        const operationAST = getOperationAST(args.document, args.operationName);

        // Stops the subscription and sends an error message
        if (!operationAST) {
          return [new GraphQLError("Unable to identify operation")];
        }

        // Handle mutation and query requests
        if (operationAST.operation !== "subscription") {
          return [
            new GraphQLError("Only subscription operations are supported")
          ];
        }

        // Validate the operation document
        const errors = validate(args.schema, args.document);

        if (errors.length > 0) {
          return errors;
        }

        // Ready execution arguments
        return args;
      }
    },
    wsServer
  );

  httpServer.listen({ port }, () => {
    console.log(
      `🚀 Subscriptions ready at ws://localhost:${port}${wsServer.options.path}`
    );
  });
})();
