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

/**
 * Create a character from raw JSON.
 * Passes the JSON directly to the API - useful for Claude-generated payloads.
 */
export async function createCharacterRaw(
  characterData: Record<string, unknown>,
  campaignId?: string
): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  // Add campaign_id if provided
  const payload = { ...characterData };
  if (campaignId) {
    payload.campaign_id = campaignId;
  }

  try {
    const response = await client.post("/api/v2/characters", {
      character: payload,
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

/**
 * Update a character from raw JSON.
 * Passes the JSON directly to the API - useful for Claude-generated payloads.
 */
export async function updateCharacterRaw(
  characterId: string,
  characterData: Record<string, unknown>
): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/characters/${characterId}`, {
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
        throw new Error(`Failed to update character: ${messages}`);
      }
      throw new Error(data.message || "Failed to update character");
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

export interface Faction {
  id: string;
  name: string;
  description?: string;
  campaign_id: string;
}

export async function listFactions(): Promise<Faction[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    // Fetch all pages of factions
    const allFactions: Faction[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await client.get(`/api/v2/factions?page=${page}&per_page=100`);
      const factions = response.data.factions || [];
      allFactions.push(...factions);

      const meta = response.data.meta;
      hasMore = meta && page < meta.total_pages;
      page++;
    }

    return allFactions;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list factions");
    }
    throw error;
  }
}

export async function searchFaction(query: string): Promise<Faction | null> {
  const factions = await listFactions();
  const lowerQuery = query.toLowerCase();

  // Try exact match first
  let match = factions.find(f => f.name.toLowerCase() === lowerQuery);
  if (match) return match;

  // Try starts-with match
  match = factions.find(f => f.name.toLowerCase().startsWith(lowerQuery));
  if (match) return match;

  // Try contains match
  match = factions.find(f => f.name.toLowerCase().includes(lowerQuery));
  return match || null;
}

// CLI Browser Auth Flow

export interface CliAuthStartResponse {
  code: string;
  url: string;
  expires_in: number;
}

export interface CliAuthPollResponse {
  status: "pending" | "approved" | "expired";
  expires_in?: number;
  token?: string;
  user?: User;
  error?: string;
}

export async function startCliAuth(): Promise<CliAuthStartResponse> {
  const client = createClient();

  try {
    const response = await client.post("/api/v2/cli/auth/start");
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || "Failed to start authentication");
    }
    throw error;
  }
}

export async function pollCliAuth(code: string): Promise<CliAuthPollResponse> {
  const client = createClient();

  try {
    const response = await client.post("/api/v2/cli/auth/poll", { code });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 410) {
        return { status: "expired", error: "Authorization code expired" };
      }
      const data = error.response.data as ApiError;
      throw new Error(data.message || "Failed to poll authentication status");
    }
    throw error;
  }
}
