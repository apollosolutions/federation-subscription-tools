import { ApolloGateway } from "@apollo/gateway";
import { ApolloServer } from "apollo-server";
import {
  ApolloServerPluginUsageReporting,
  ApolloServerPluginUsageReportingDisabled
} from "apollo-server-core";

const isProd = process.env.NODE_ENV === "production";
const apolloKey = process.env.APOLLO_KEY;

let gatewayOptions = {
  debug: isProd ? false : true
};

if (!apolloKey) {
  console.log("Head to https://studio.apollographql.com an create an account");

  gatewayOptions.serviceList = [
    { name: "authors", url: process.env.AUTHORS_SERVICE_URL },
    { name: "posts", url: process.env.POSTS_SERVICE_URL }
  ];
}

const apolloUsageReportingPlugin = apolloKey
  ? ApolloServerPluginUsageReporting()
  : ApolloServerPluginUsageReportingDisabled();

const gateway = new ApolloGateway(gatewayOptions);
const server = new ApolloServer({
  gateway,
  subscriptions: false,
  plugins: [apolloUsageReportingPlugin]
});

server.listen(process.env.GATEWAY_PORT).then(({ url }) => {
  console.log(`🚀 Gateway API running at ${url}`);
});
