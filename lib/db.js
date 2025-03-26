import { createClient } from "redis";
import { RedisAdapter } from "@grammyjs/storage-redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({ url: process.env.REDIS_URL });

const DB = {
  redisClient,
  sessionStorage: null,

  async getUser(userID) {
    const data = await redisClient.hGet("users2fa", String(userID));
    return data ? JSON.parse(data) : null;
  },

  async setUser(userID, { secret, firstName, lastName, userId }) {
    await redisClient.hSet(
      "users2fa",
      String(userID),
      JSON.stringify({ secret, firstName, lastName, userId })
    );
  },

  async deleteUser(userID) {
    await redisClient.hDel("users2fa", String(userID));
  },

  async deleteAllUsers() {
    await redisClient.del("users2fa");
    console.log("✅ All users deleted from Redis.");
  },

  async getAllUsers() {
    const users = await redisClient.hGetAll("users2fa");
    return Object.entries(users).map(([userID, userData]) => ({
      userID,
      ...JSON.parse(userData),
    }));
  },

  async connect() {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("✅ Redis connected");
    }

    if (!this.sessionStorage) {
      this.sessionStorage = new RedisAdapter({ instance: redisClient });
    }

    await this.deleteAllUsers();
  },
};

DB.connect().catch((err) => console.error("❌ Redis connection error:", err));

export default DB;
