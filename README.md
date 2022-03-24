# Using Subscriptions with a Federated Data Graph

This demonstration library shows how a decoupled subscription service can run alongside a federated data graph to provide real-time updates to a client. While the subscription service runs a separate non-federated Apollo Server, client applications do not need to perform any special handling of their subscription operations and may send those requests as they would to any GraphQL API that supports subscriptions. The subscription service's API may also specify return types for the `Subscription` fields that are defined in the federated data graph without explicitly redefining them in that service's type definitions.

**In brief, the utilities contained within this library will allow you to:**

- Create a decoupled, independently scalable subscriptions service to run alongside a unified data graph
- Use types defined in your unified data graph as return types within the subscriptions service's type definitions (without manually redefining those types in the subscriptions service)
- Publish messages to a shared pub/sub implementation from any subgraph service
- Allow clients to write subscription operations just as they would if the `Subscription` fields were defined directly within the unified data graph itself

## Example Usage

The following section outlines how to use the utilities included with this library. The following code is based on a complete working example that has been included in the `example` directory of this repository. Please reference the full example code for additional implementation details and context.

### Make an Executable Schema from Federated and Subscription Type Definitions

The subscriptions service should only contain a definition for the `Subscription` object type, the types on this field may output any of the types defined in the federated data graph's schema:

```js
// typeDefs.js (subscriptions service)

import gql from "graphql-tag";

export const typeDefs = gql`
  type Subscription {
    postAdded: Post
  }
`;
```

To make the federated data graph's types available to the subscription service, instantiate an `ApolloGateway` and call the `makeSubscriptionSchema` function in the gateway's `onSchemaLoadOrUpdate` method to combine its schema with the subscription service's type definitions and resolvers to make the complete executable schema.

**Managed federation option:**

```js
// index.js (subscriptions service)
let schema;
const gateway = new ApolloGateway();

gateway.onSchemaLoadOrUpdate(schemaContext => {
  schema = makeSubscriptionSchema({
    gatewaySchema: schemaContext.apiSchema,
    typeDefs,
    resolvers
  });
});

await gateway.load({ apollo: getGatewayApolloConfig(apolloKey, graphVariant) });
```

**Unmanaged federation option:**

```js
// index.js (subscriptions service)
let schema;
const gateway = new ApolloGateway({
  serviceList: [
    /* Provide your service list here... */
  ],
  experimental_pollInterval = 36000;
});

gateway.onSchemaLoadOrUpdate(schemaContext => {
  schema = makeSubscriptionSchema({
    gatewaySchema: schemaContext.apiSchema,
    typeDefs,
    resolvers
  });
});

await gateway.load();
```

Note that for unmanaged federation, we must set a poll interval to query the subgraph services for their schemas to detect a schema change. Polling the running endpoint for these SDLs is fairly blunt approach, so in production, a more computationally efficient approach would be preferable (or managed federation).

### Use an Apollo Data Source to Fetch Non-Payload Fields

The subscription service can resolve fields that are included in a published message's payload, but it will need to reach out to the federated data graph to resolve additional non-payload fields. Using an Apollo data source subclassed from the provided `GatewayDataSource`, specific methods can be defined that fetch the non-payload fields by diffing the payload fields with the overall selection set. Optionally, headers (etc.) may be attached to the request to the federated data graph by providing a `willSendRequest` method:

```js
// LiveBlogDataSource/index.js (subscriptions service)

import { GatewayDataSource } from "federation-subscription-tools";
import gql from "graphql-tag";

export class LiveBlogDataSource extends GatewayDataSource {
  constructor(gatewayUrl) {
    super(gatewayUrl);
  }

  willSendRequest(request) {
    if (!request.headers) {
      request.headers = {};
    }

    request.headers["apollographql-client-name"] = "Subscriptions Service";
    request.headers["apollographql-client-version"] = "0.1.0";

    // Forwards the encoded token extracted from the `connectionParams` with
    // the request to the gateway
    request.headers.authorization = `Bearer ${this.context.token}`;
  }

  async fetchAndMergeNonPayloadPostData(postID, payload, info) {
    const selections = this.buildNonPayloadSelections(payload, info);
    const payloadData = Object.values(payload)[0];

    if (!selections) {
      return payloadData;
    }

    const Subscription_GetPost = gql`
      query Subscription_GetPost($id: ID!) {
        post(id: $id) {
          ${selections}
        }
      }
    `;

    try {
      const response = await this.query(Subscription_GetPost, {
        variables: { id: postID }
      });
      return this.mergeFieldData(payloadData, response.data.post);
    } catch (error) {
      console.error(error);
    }
  }
}

```

In the resolvers for the subscription field, the `fetchAndMergeNonPayloadPostData` method may be called to resolve all requested field data:

```js
// resolvers.js (subscriptions service)

const resolvers = {
  Subscription: {
    postAdded: {
      resolve(payload, args, { dataSources: { gatewayApi } }, info) {
        return gatewayApi.fetchAndMergeNonPayloadPostData(
          payload.postAdded.id,
          payload, // known field values
          info // contains the complete field selection set to diff
        );
      },
      subscribe(_, args) {
        return pubsub.asyncIterator(["POST_ADDED"]);
      }
    }
  }
};
```

In effect, this means that as long the resource that is used as the output type for any subscriptions field may be queried from the federated data graph, then this node may be used as an entry point to that data graph to resolve non-payload fields.

For the gateway data source to be accessible in `Subscription` field resolvers, we must manually add it to the request context using the `addGatewayDataSourceToSubscriptionContext` function. Note that this example uses [graphql-ws](https://github.com/enisdenjo/graphql-ws) to serve the WebSocket-enabled endpoint for subscription operations. A sample implementation may be structured as follows:

```js
// index.js (subscriptions service)

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
```

## Try the Demo

### Installation & Set-up

The full example code can be found in the `example` directory. To run the example, you'll need to create a new graph in Apollo Studio for the gateway, [configure rover](https://www.apollographql.com/docs/rover/configuring) with your `APOLLO_KEY`, and then push the two services' schemas:

```sh
rover subgraph introspect http://localhost:4001 | rover subgraph publish blog@current --schema - --name authors --routing-url http://localhost:4001
```

```sh
rover subgraph introspect http://localhost:4002 | rover subgraph publish blog@current --schema - --name posts --routing-url http://localhost:4002
```

**Important!** The services for the authors and posts subgraphs will need to be running to fetch their schemas from the specified endpoints. You can quickly start up these services without the overhead of running a full `docker-compose` first by running `npm run server:authors` and `npm run server:posts` from the `example/gateway-server` directory (in two different terminal windows). Once the schemas have been successfully pushed to Apollo Studio, you can kill these processes.

Next, add `.env` files to the server and client directories:

1. Add a `.env` file to the `example/gateway-server` directory using the `example/gateway-server/.env.sample` file as a template. Add your new `APOLLO_KEY` and `APOLLO_GRAPH_REF` as variables.
2. Add a `.env` file to the `example/subscriptions-server` directory using the `example/subscriptions-server/.env.sample` file as a template. Add the same Apollo API key as the `APOLLO_KEY` and `APOLLO_GRAPH_REF`.
3. Add a `.env` file to the `example/client` directory using the `example/client/.env.sample` file as a template.

Finally, run `docker-compose up --build` from the `example` directory to start all services.

The federated data graph endpoint may be accessed at [http://localhost:4000/graphql](http://localhost:4000/graphql).

The subscriptions service WebSocket endpoint may be accessed at [ws://localhost:5000/graphql](ws://localhost:5000/graphql).

A React app will be available at [http://localhost:3000](http://localhost:3000).

### Usage

To see the post list in the client app update in real-time, add a new post at [http://localhost:3000/post/add](http://localhost:3000/post/add) or run the following mutation directly:

```graphql
mutation AddPost {
  addPost(authorID: 1, content: "Hello, world!", title: "My Next Post") {
    id
    author {
      name
    }
    content
    publishedAt
    title
  }
}
```

### Rationale

The architecture demonstrated in this project seeks to provide a bridge to native `Subscription` operation support in Apollo Federation. This approach to subscriptions has the advantage of allowing the Apollo Gateway API to remain as the "stateless execution engine" of a federated data graph while offloading all subscription requests to a separate service, thus allowing the subscription service to be scaled independently of the gateway.

To allow the `Subscription` fields to specify return types that are defined in gateway API only, the federated data graph's type definitions are merged with the subscription service's type definitions and resolvers in the gateway's `onSchemaChange` callback to avoid re-declaring these types explicitly here.

### Architectural Details

#### Components

Docker will start five different services with `docker-compose up`:

**1. Gateway Server + Subgraph Services**

This service contains the federated data graph. For simplicity's sake, two implementing services (for authors and posts) have been bundled with the gateway API in this service. Each implementing service connects to Redis as needed so it can publish events from mutations (the "pub" end of subscriptions). For example:

```js
import { pubsub } from "./redis";

export const resolvers = {
  // ...
  Mutation: {
    addPost(root, args, context, info) {
      const post = newPost();
      pubsub.publish("POST_ADDED", { postAdded: post });
      return post;
    }
  }
};
```

**2. Subscriptions Server**

This service also connects to Redis to facilitate the "sub" end of the subscriptions. This service is where the `Subscription` type and related fields are defined. As a best practice, only define a `Subscription` type and applicable resolvers in this service.

When sending subscription data to clients, the subscription service can't automatically resolve any data beyond what's provided in the published payload from the implementing service. This means that to resolve nested types (or any other fields that aren't immediately available in the payload object), the resolvers must be defined in the subscription services to fetch this data on a field-by-field basis.

There are a number of possible approaches that could be taken here, but one recommended approach is to provide an Apollo data source with methods that automatically compare the fields included in the payload against the fields requested in the operation, then selectively query the necessary field data in a single request to the gateway, and finally combine the returned data with the with original payload data to fully resolve the request. For example:

```js
import { pubsub } from "./redis";

export const resolvers = {
  Subscription: {
    postAdded: {
      resolve(payload, args, { dataSources: { gatewayApi } }, info) {
        return gatewayApi.fetchAndMergeNonPayloadPostData(
          payload.postAdded.id,
          payload,
          info
        );
      },
      subscribe(_, args) {
        return pubsub.asyncIterator(["POST_ADDED"]);
      }
    }
  }
};
```

**3. Redis**

A shared Redis instance is used to capture publications from the services behind the federated data graph as well as the subscriptions initiated in the subscriptions service, though other [`PubSub` implementations](https://www.apollographql.com/docs/apollo-server/data/subscriptions/#pubsub-implementations) could easily be supported. Note that an in-memory pub/sub implementation will not work because it cannot be shared between the separate gateway and subscription services.

**4. React App**

The React app contains a homepage with a list of posts as well as a form to add new posts. When a new post is added, the feed of posts on the homepage will be automatically updated.

#### Diagram

The architecture of the provided example may be visualized as follows:

![Architectural diagram of a federated data graph with a subscriptions service and a React client app](./example/architecture.drawio.svg)

## Important Considerations

**Subscriptions Must be Defined in a Single Service:**

This solution requires all `Subscription` fields to be defined in a single, decoupled subscription service. This requirement may necessitate that ownership of this service is shared amongst teams that otherwise manage independent portions of the schema applicable to queries and mutations.

**Synchronizing Event Labels:**

Some level of coordination would be necessary to ensure that event labels (e.g. `POST_ADDED`) are synchronized between the implementing services that publish events and the subscription service that calls the `asyncIterator` method with these labels as arguments. Breaking changes may occur without such coordination.
