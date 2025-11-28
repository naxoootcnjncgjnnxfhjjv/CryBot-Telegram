import dotenv from "dotenv";
dotenv.config();

export const BOT_TOKEN = process.env.BOT_TOKEN;
export const OPENSEA_KEY = process.env.OPENSEA_KEY;
export const TONAPI_KEY = process.env.TONAPI_KEY;
export const APTOS_NODE = process.env.APTOS_NODE;
export const PRIVATE_KEYS = (process.env.PRIVATE_KEYS || "").split(",");
