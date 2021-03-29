const {
  addGatewayDataSourceToSubscriptionContext
} = require("./utils/subscriptions");
const { GatewayDataSource } = require("./datasources/GatewayDataSource");
const {
  getGatewayApolloConfig,
  makeSubscriptionSchema
} = require("./utils/schema");

module.exports = {
  addGatewayDataSourceToSubscriptionContext,
  GatewayDataSource,
  getGatewayApolloConfig,
  makeSubscriptionSchema
};
