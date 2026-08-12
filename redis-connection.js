import Redis from "ioredis";

function createRedisConnection() {
    return new Redis({
        port: 6379, // Redis port
        host: "localhost", // Redis host
    });
}


export const redis = createRedisConnection();
export const publisher  = createRedisConnection();
export const subscriber = createRedisConnection();