import axios, { AxiosInstance, AxiosError } from "axios";
import { getApiUrl, getToken } from "./config.js";
import type {
  User,
  Character,
  CreateCharacterParams,
} from "../types/index.js";

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

function createClient(token?: string | null): AxiosInstance {
  const client = axios.create({
    baseURL: getApiUrl(),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (token) {
    client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  return client;
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const client = createClient();

  try {
    const response = await client.post("/users/sign_in", {
      user: { email, password },
    });

    // Token comes in Authorization header
    const authHeader = response.headers["authorization"];
    const token = authHeader?.replace("Bearer ", "") ?? "";

    return {
      user: response.data,
      token,
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || "Authentication failed");
    }
    throw error;
  }
}

export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get("/api/v2/users/current");
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 401) {
      throw new Error("Session expired. Run 'chiwar login' to re-authenticate.");
    }
    throw error;
  }
}

export async function createCharacter(
  params: CreateCharacterParams,
  campaignId?: string
): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  // Build the character payload
  const characterData: Record<string, unknown> = {
    name: params.name,
    character_type: params.character_type,
    active: true,
  };

  if (params.wounds !== undefined) characterData.wounds = params.wounds;
  if (params.defense !== undefined) characterData.defense = params.defense;
  if (params.speed !== undefined) characterData.speed = params.speed;
  if (params.toughness !== undefined) characterData.toughness = params.toughness;
  if (params.fortune !== undefined) characterData.fortune = params.fortune;
  if (params.description !== undefined) characterData.description = params.description;
  if (campaignId) characterData.campaign_id = campaignId;

  try {
    const response = await client.post("/api/v2/characters", {
      character: characterData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create character: ${messages}`);
      }
      throw new Error(data.message || "Failed to create character");
    }
    throw error;
  }
}

export async function listCampaigns(): Promise<
  Array<{ id: string; name: string }>
> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get("/api/v2/campaigns");
    return response.data.campaigns || response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list campaigns");
    }
    throw error;
  }
}
