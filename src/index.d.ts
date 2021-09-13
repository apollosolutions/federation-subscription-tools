declare module 'federation-subscription-tools' {
  import { DataSource } from 'apollo-datasource'
  import type {
      ApolloLink,
      FetchResult,
  } from 'apollo-link'
  import type { DocumentNode, GraphQLSchema } from 'graphql'

  type Muteable<T> = { -readonly [P in keyof T]: T[P] }

  export type MuteableRequest = Muteable<Request>

  export class GatewayDataSource extends DataSource {
      constructor(gatewayUrl: string)

      willSendRequest(request: Muteable<Request>): void

      composeLinks(): ApolloLink

      didEncounterError(error: unknown): void

      onErrorLink(): ApolloLink

      onRequestLink(): ApolloLink

      resolveUri(): string

      // Utils that support diffing payload fields with operation field selections

      addDelimiter(a: string, b: string): string

      isObject(value: unknown): boolean

      isFieldObject(object: unknown): boolean

      fieldPathsAsStrings(object: unknown): string

      fieldPathsAsMapFromResolveInfo(resolveInfo: unknown): Record<string, unknown>

      buildSelection(selection: unknown, pathString: unknown, pathParts: unknown, fieldPathMap: unknown, index: unknown): string

      buildNonPayloadSelections(payload: unknown, info: unknown): string

      mergeFieldData(payloadFieldData: unknown, nonPayloadFieldData: unknown): Record<string, unknown>

      query(query: unknown, options: unknown): Promise<FetchResult>
  }

  export function addGatewayDataSourceToSubscriptionContext(context: unknown, gatewayDataSource: GatewayDataSource):
    { dataSources: { gatewayApi: GatewayDataSource } }

  export function makeSubscriptionSchema(options: {
      gatewaySchema: GraphQLSchema,
      resolvers: unknown,
      typeDefs: DocumentNode,
  }): GraphQLSchema

  export function getGatewayApolloConfig(key: string, graphVariant: string): {
    graphId: string
    graphVariant: string
    key: string
    keyHash: string
  }
}
