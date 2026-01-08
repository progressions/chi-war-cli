import axios, { AxiosInstance, AxiosError } from "axios";
import FormData from "form-data";
import * as fs from "fs";
import * as path from "path";
import { getApiUrl, getToken } from "./config.js";
import type {
  User,
  Character,
  CreateCharacterParams,
  Party,
  Campaign,
  CampaignListResponse,
  PaginationMeta,
  Fight,
  FightListResponse,
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

export interface CreateCharacterRawOptions {
  campaignId?: string;
  imagePath?: string;
}

/**
 * Create a character from raw JSON.
 * Passes the JSON directly to the API - useful for Claude-generated payloads.
 * Optionally uploads an image file if imagePath is provided.
 */
export async function createCharacterRaw(
  characterData: Record<string, unknown>,
  options: CreateCharacterRawOptions = {}
): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  // Add campaign_id if provided
  const payload = { ...characterData };
  if (options.campaignId) {
    payload.campaign_id = options.campaignId;
  }

  try {
    let response;

    if (options.imagePath) {
      // Verify the file exists
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Image file not found: ${options.imagePath}`);
      }

      // Use multipart form data for image upload
      const formData = new FormData();
      formData.append("character", JSON.stringify(payload));
      formData.append("image", fs.createReadStream(options.imagePath), {
        filename: path.basename(options.imagePath),
      });

      response = await axios.post(`${getApiUrl()}/api/v2/characters`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      // Standard JSON request
      const client = createClient(token);
      response = await client.post("/api/v2/characters", {
        character: payload,
      });
    }

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

export interface UpdateCharacterRawOptions {
  imagePath?: string;
}

/**
 * Update a character from raw JSON.
 * Passes the JSON directly to the API - useful for Claude-generated payloads.
 * Optionally uploads an image file if imagePath is provided.
 */
export async function updateCharacterRaw(
  characterId: string,
  characterData: Record<string, unknown>,
  options: UpdateCharacterRawOptions = {}
): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  try {
    let response;

    if (options.imagePath) {
      // Verify the file exists
      if (!fs.existsSync(options.imagePath)) {
        throw new Error(`Image file not found: ${options.imagePath}`);
      }

      // Use multipart form data for image upload
      const formData = new FormData();
      formData.append("character", JSON.stringify(characterData));
      formData.append("image", fs.createReadStream(options.imagePath), {
        filename: path.basename(options.imagePath),
      });

      response = await axios.patch(`${getApiUrl()}/api/v2/characters/${characterId}`, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${token}`,
        },
      });
    } else {
      // Standard JSON request
      const client = createClient(token);
      response = await client.patch(`/api/v2/characters/${characterId}`, {
        character: characterData,
      });
    }

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

// =============================================================================
// Campaign API
// =============================================================================

export interface ListCampaignsOptions {
  limit?: number;
  page?: number;
}

export async function listCampaigns(
  options: ListCampaignsOptions = {}
): Promise<CampaignListResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());

  try {
    const response = await client.get(`/api/v2/campaigns?${params.toString()}`);
    return {
      campaigns: response.data.campaigns || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list campaigns");
    }
    throw error;
  }
}

export async function getCampaign(campaignId: string): Promise<Campaign> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/campaigns/${campaignId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      throw new Error("Failed to get campaign");
    }
    throw error;
  }
}

export async function createCampaign(
  campaignData: Record<string, unknown>
): Promise<Campaign> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/campaigns", {
      campaign: campaignData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create campaign: ${messages}`);
      }
      throw new Error(data.message || "Failed to create campaign");
    }
    throw error;
  }
}

export async function updateCampaign(
  campaignId: string,
  campaignData: Record<string, unknown>
): Promise<Campaign> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/campaigns/${campaignId}`, {
      campaign: campaignData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update campaign: ${messages}`);
      }
      throw new Error(data.message || "Failed to update campaign");
    }
    throw error;
  }
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/campaigns/${campaignId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      throw new Error("Failed to delete campaign");
    }
    throw error;
  }
}

export async function setCurrentCampaign(campaignId: string): Promise<Campaign> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/campaigns/${campaignId}/set`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }
      throw new Error("Failed to set current campaign");
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

export interface ListCharactersOptions {
  campaignId?: string;
  limit?: number;
  page?: number;
  sort?: string;
  direction?: "asc" | "desc";
}

export interface ListCharactersResponse {
  characters: Character[];
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

export async function listCharacters(
  options: ListCharactersOptions = {}
): Promise<ListCharactersResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.campaignId) params.append("campaign_id", options.campaignId);
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());
  if (options.sort) params.append("sort", options.sort);
  if (options.direction) params.append("direction", options.direction);

  try {
    const response = await client.get(`/api/v2/characters?${params.toString()}`);
    return {
      characters: response.data.characters || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list characters");
    }
    throw error;
  }
}

export async function getCharacter(characterId: string): Promise<Character> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/characters/${characterId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Character not found: ${characterId}`);
      }
      throw new Error("Failed to get character");
    }
    throw error;
  }
}

// =============================================================================
// Party API
// =============================================================================

export interface ListPartiesOptions {
  limit?: number;
  page?: number;
}

export interface ListPartiesResponse {
  parties: Party[];
  meta: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

export async function listParties(
  options: ListPartiesOptions = {}
): Promise<ListPartiesResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());

  try {
    const response = await client.get(`/api/v2/parties?${params.toString()}`);
    return {
      parties: response.data.parties || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list parties");
    }
    throw error;
  }
}

export async function getParty(partyId: string): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/parties/${partyId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Party not found: ${partyId}`);
      }
      throw new Error("Failed to get party");
    }
    throw error;
  }
}

export async function createParty(
  partyData: Record<string, unknown>
): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/parties", {
      party: partyData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create party: ${messages}`);
      }
      throw new Error(data.message || "Failed to create party");
    }
    throw error;
  }
}

export async function updateParty(
  partyId: string,
  partyData: Record<string, unknown>
): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/parties/${partyId}`, {
      party: partyData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update party: ${messages}`);
      }
      throw new Error(data.message || "Failed to update party");
    }
    throw error;
  }
}

export async function deleteParty(partyId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/parties/${partyId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Party not found: ${partyId}`);
      }
      throw new Error("Failed to delete party");
    }
    throw error;
  }
}

export interface PartyTemplateSlot {
  role: string;
  label: string;
  default_mook_count?: number;
}

export interface PartyTemplate {
  key: string;
  name: string;
  description: string;
  slots: PartyTemplateSlot[];
}

export async function listPartyTemplates(): Promise<PartyTemplate[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get("/api/v2/parties/templates");
    return response.data.templates || [];
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list party templates");
    }
    throw error;
  }
}

export async function applyPartyTemplate(
  partyId: string,
  templateKey: string
): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/parties/${partyId}/apply_template`, {
      template_key: templateKey,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Party or template not found");
      }
      throw new Error("Failed to apply template");
    }
    throw error;
  }
}

export async function assignCharacterToSlot(
  partyId: string,
  slotId: string,
  characterId: string
): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/parties/${partyId}/slots/${slotId}`, {
      character_id: characterId,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Party or slot not found");
      }
      throw new Error("Failed to assign character to slot");
    }
    throw error;
  }
}

export async function clearSlot(
  partyId: string,
  slotId: string
): Promise<Party> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/parties/${partyId}/slots/${slotId}`, {
      character_id: null,
      vehicle_id: null,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Party or slot not found");
      }
      throw new Error("Failed to clear slot");
    }
    throw error;
  }
}

// =============================================================================
// Fight API
// =============================================================================

export interface ListFightsOptions {
  limit?: number;
  page?: number;
  active?: boolean;
}

export async function listFights(
  options: ListFightsOptions = {}
): Promise<FightListResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());
  if (options.active !== undefined) params.append("active", options.active.toString());

  try {
    const response = await client.get(`/api/v2/fights?${params.toString()}`);
    return {
      fights: response.data.fights || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list fights");
    }
    throw error;
  }
}

export async function getFight(fightId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/fights/${fightId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight not found: ${fightId}`);
      }
      throw new Error("Failed to get fight");
    }
    throw error;
  }
}

export async function createFight(
  fightData: Record<string, unknown>
): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/fights", {
      fight: fightData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create fight: ${messages}`);
      }
      throw new Error(data.message || "Failed to create fight");
    }
    throw error;
  }
}

export async function updateFight(
  fightId: string,
  fightData: Record<string, unknown>
): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/fights/${fightId}`, {
      fight: fightData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update fight: ${messages}`);
      }
      throw new Error(data.message || "Failed to update fight");
    }
    throw error;
  }
}

export async function deleteFight(fightId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/fights/${fightId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight not found: ${fightId}`);
      }
      throw new Error("Failed to delete fight");
    }
    throw error;
  }
}

export async function endFight(fightId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/fights/${fightId}/end_fight`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight not found: ${fightId}`);
      }
      throw new Error("Failed to end fight");
    }
    throw error;
  }
}

export async function resetFight(fightId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/fights/${fightId}/reset`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight not found: ${fightId}`);
      }
      throw new Error("Failed to reset fight");
    }
    throw error;
  }
}
