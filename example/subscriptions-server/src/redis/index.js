import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

export const redis = new Redis(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST_ADDRESS
);

export const pubsub = new RedisPubSub({
  publisher: redis,
  subscriber: redis
});
