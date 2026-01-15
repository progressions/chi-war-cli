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
  Site,
  SiteListResponse,
  Juncture,
  JunctureListResponse,
  Vehicle,
  VehicleListResponse,
  Weapon,
  WeaponListResponse,
  Schtick,
  SchtickListResponse,
  EntityClass,
  AiJobResponse,
  AiAttachResponse,
  MediaLibraryImage,
  MediaLibraryResponse,
  Encounter,
  SwerveResult,
  Notification,
} from "../types/index.js";

export interface ApiError {
  message?: string;
  error?: string;
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
    const response = await client.post(`/api/v2/campaigns/current`, {
      campaign_id: campaignId,
    });
    // Server returns {campaign: ..., user: ...}, extract campaign
    return response.data.campaign;
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
  at_a_glance?: boolean;
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

export async function getFaction(factionId: string): Promise<Faction> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/factions/${factionId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Faction not found: ${factionId}`);
      }
      throw new Error("Failed to get faction");
    }
    throw error;
  }
}

export async function createFaction(
  factionData: Record<string, unknown>
): Promise<Faction> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/factions", {
      faction: factionData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create faction: ${messages}`);
      }
      throw new Error(data.message || "Failed to create faction");
    }
    throw error;
  }
}

export async function updateFaction(
  factionId: string,
  factionData: Record<string, unknown>
): Promise<Faction> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/factions/${factionId}`, {
      faction: factionData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update faction: ${messages}`);
      }
      throw new Error(data.message || "Failed to update faction");
    }
    throw error;
  }
}

export async function deleteFaction(factionId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/factions/${factionId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Faction not found: ${factionId}`);
      }
      throw new Error("Failed to delete faction");
    }
    throw error;
  }
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

export async function deleteCharacter(characterId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/characters/${characterId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Character not found: ${characterId}`);
      }
      throw new Error("Failed to delete character");
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

export async function addPartyToFight(fightId: string, partyId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/fights/${fightId}/add_party`, {
      party_id: partyId,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight or party not found`);
      }
      if (error.response.status === 403) {
        throw new Error("Only gamemaster can add parties to fights");
      }
      throw new Error("Failed to add party to fight");
    }
    throw error;
  }
}

export async function addCharacterToFight(fightId: string, characterId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    // Get current fight to get existing character_ids
    const fightResponse = await client.get(`/api/v2/fights/${fightId}`);
    const fight = fightResponse.data;

    // Get existing character_ids
    const existingIds: string[] = fight.character_ids || [];

    // Check if character is already in fight
    if (existingIds.includes(characterId)) {
      throw new Error("Character is already in this fight");
    }

    // Add new character_id
    const updatedIds = [...existingIds, characterId];

    // Update fight with new character_ids
    const response = await client.patch(`/api/v2/fights/${fightId}`, {
      fight: { character_ids: updatedIds },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight or character not found`);
      }
      if (error.response.status === 403) {
        throw new Error("Only gamemaster can add characters to fights");
      }
      throw new Error("Failed to add character to fight");
    }
    throw error;
  }
}

export async function addVehicleToFight(fightId: string, vehicleId: string): Promise<Fight> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    // Get current fight to get existing vehicle_ids
    const fightResponse = await client.get(`/api/v2/fights/${fightId}`);
    const fight = fightResponse.data;

    // Get existing vehicle_ids
    const existingIds: string[] = fight.vehicle_ids || [];

    // Check if vehicle is already in fight
    if (existingIds.includes(vehicleId)) {
      throw new Error("Vehicle is already in this fight");
    }

    // Add new vehicle_id
    const updatedIds = [...existingIds, vehicleId];

    // Update fight with new vehicle_ids
    const response = await client.patch(`/api/v2/fights/${fightId}`, {
      fight: { vehicle_ids: updatedIds },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Fight or vehicle not found`);
      }
      if (error.response.status === 403) {
        throw new Error("Only gamemaster can add vehicles to fights");
      }
      throw new Error("Failed to add vehicle to fight");
    }
    throw error;
  }
}

// =============================================================================
// Encounter API (Combat Management)
// =============================================================================

export async function getEncounter(fightId: string): Promise<Encounter> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/encounters/${fightId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Encounter not found: ${fightId}`);
      }
      throw new Error("Failed to get encounter");
    }
    throw error;
  }
}

export async function spendShots(
  fightId: string,
  shotId: string,
  shots: number = 3
): Promise<Encounter> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/encounters/${fightId}/act`, {
      shot_id: shotId,
      shots: shots,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Encounter or shot not found`);
      }
      if (error.response.status === 403) {
        throw new Error("Only gamemaster can modify encounters");
      }
      throw new Error("Failed to spend shots");
    }
    throw error;
  }
}

export interface CombatEvent {
  event_type: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface CombatUpdate {
  shot_id: string;
  character_id?: string;
  wounds?: number;
  impairments?: number;
  count?: number;
  location?: string;
  action_values?: Record<string, unknown>;
  add_status?: string[];
  remove_status?: string[];
  event?: CombatEvent;
}

export async function applyCombatAction(
  fightId: string,
  updates: CombatUpdate[]
): Promise<Encounter> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/encounters/${fightId}/apply_combat_action`, {
      character_updates: updates,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Encounter not found`);
      }
      if (error.response.status === 403) {
        throw new Error("Only gamemaster can apply combat actions");
      }
      throw new Error("Failed to apply combat action");
    }
    throw error;
  }
}

export async function updateShotLocation(
  fightId: string,
  shotId: string,
  location: string
): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.patch(`/api/v2/fights/${fightId}/shots/${shotId}`, {
      shot: { location },
    });
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Shot not found");
      }
      throw new Error("Failed to update location");
    }
    throw error;
  }
}

export async function rollSwerve(): Promise<SwerveResult> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/dice/swerve`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to roll swerve");
    }
    throw error;
  }
}

export interface InitiativeUpdate {
  id: string;
  shot: number;
}

export async function updateInitiatives(
  fightId: string,
  shots: InitiativeUpdate[]
): Promise<Encounter> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/encounters/${fightId}/update_initiatives`, {
      shots: shots,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Encounter not found`);
      }
      throw new Error("Failed to update initiatives");
    }
    throw error;
  }
}

// =============================================================================
// Site API
// =============================================================================

export interface ListSitesOptions {
  limit?: number;
  page?: number;
  active?: boolean;
}

export async function listSites(
  options: ListSitesOptions = {}
): Promise<SiteListResponse> {
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
    const response = await client.get(`/api/v2/sites?${params.toString()}`);
    return {
      sites: response.data.sites || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list sites");
    }
    throw error;
  }
}

export async function getSite(siteId: string): Promise<Site> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/sites/${siteId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Site not found: ${siteId}`);
      }
      throw new Error("Failed to get site");
    }
    throw error;
  }
}

export async function createSite(
  siteData: Record<string, unknown>
): Promise<Site> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/sites", {
      site: siteData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create site: ${messages}`);
      }
      throw new Error(data.message || "Failed to create site");
    }
    throw error;
  }
}

export async function updateSite(
  siteId: string,
  siteData: Record<string, unknown>
): Promise<Site> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/sites/${siteId}`, {
      site: siteData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update site: ${messages}`);
      }
      throw new Error(data.message || "Failed to update site");
    }
    throw error;
  }
}

export async function deleteSite(siteId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/sites/${siteId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Site not found: ${siteId}`);
      }
      throw new Error("Failed to delete site");
    }
    throw error;
  }
}

// =============================================================================
// Juncture API
// =============================================================================

export interface ListJuncturesOptions {
  limit?: number;
  page?: number;
  active?: boolean;
}

export async function listJunctures(
  options: ListJuncturesOptions = {}
): Promise<JunctureListResponse> {
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
    const response = await client.get(`/api/v2/junctures?${params.toString()}`);
    return {
      junctures: response.data.junctures || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list junctures");
    }
    throw error;
  }
}

export async function getJuncture(junctureId: string): Promise<Juncture> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/junctures/${junctureId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Juncture not found: ${junctureId}`);
      }
      throw new Error("Failed to get juncture");
    }
    throw error;
  }
}

export async function createJuncture(
  junctureData: Record<string, unknown>
): Promise<Juncture> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/junctures", {
      juncture: junctureData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create juncture: ${messages}`);
      }
      throw new Error(data.message || "Failed to create juncture");
    }
    throw error;
  }
}

export async function updateJuncture(
  junctureId: string,
  junctureData: Record<string, unknown>
): Promise<Juncture> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/junctures/${junctureId}`, {
      juncture: junctureData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update juncture: ${messages}`);
      }
      throw new Error(data.message || "Failed to update juncture");
    }
    throw error;
  }
}

export async function deleteJuncture(junctureId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/junctures/${junctureId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Juncture not found: ${junctureId}`);
      }
      throw new Error("Failed to delete juncture");
    }
    throw error;
  }
}

// =============================================================================
// Vehicle API
// =============================================================================

export interface ListVehiclesOptions {
  limit?: number;
  page?: number;
  active?: boolean;
}

export async function listVehicles(
  options: ListVehiclesOptions = {}
): Promise<VehicleListResponse> {
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
    const response = await client.get(`/api/v2/vehicles?${params.toString()}`);
    return {
      vehicles: response.data.vehicles || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list vehicles");
    }
    throw error;
  }
}

export async function getVehicle(vehicleId: string): Promise<Vehicle> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Vehicle not found: ${vehicleId}`);
      }
      throw new Error("Failed to get vehicle");
    }
    throw error;
  }
}

export async function createVehicle(
  vehicleData: Record<string, unknown>
): Promise<Vehicle> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/vehicles", {
      vehicle: vehicleData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create vehicle: ${messages}`);
      }
      throw new Error(data.message || "Failed to create vehicle");
    }
    throw error;
  }
}

export async function updateVehicle(
  vehicleId: string,
  vehicleData: Record<string, unknown>
): Promise<Vehicle> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/vehicles/${vehicleId}`, {
      vehicle: vehicleData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update vehicle: ${messages}`);
      }
      throw new Error(data.message || "Failed to update vehicle");
    }
    throw error;
  }
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/vehicles/${vehicleId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Vehicle not found: ${vehicleId}`);
      }
      throw new Error("Failed to delete vehicle");
    }
    throw error;
  }
}

// =============================================================================
// Weapon API
// =============================================================================

export interface ListWeaponsOptions {
  limit?: number;
  page?: number;
  active?: boolean;
  characterId?: string;
}

export async function listWeapons(
  options: ListWeaponsOptions = {}
): Promise<WeaponListResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());
  if (options.active !== undefined) params.append("active", options.active.toString());
  if (options.characterId) params.append("character_id", options.characterId);

  try {
    const response = await client.get(`/api/v2/weapons?${params.toString()}`);
    return {
      weapons: response.data.weapons || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list weapons");
    }
    throw error;
  }
}

export async function getWeapon(weaponId: string): Promise<Weapon> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/weapons/${weaponId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Weapon not found: ${weaponId}`);
      }
      throw new Error("Failed to get weapon");
    }
    throw error;
  }
}

export async function createWeapon(
  weaponData: Record<string, unknown>
): Promise<Weapon> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/weapons", {
      weapon: weaponData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create weapon: ${messages}`);
      }
      throw new Error(data.message || "Failed to create weapon");
    }
    throw error;
  }
}

export async function updateWeapon(
  weaponId: string,
  weaponData: Record<string, unknown>
): Promise<Weapon> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/weapons/${weaponId}`, {
      weapon: weaponData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update weapon: ${messages}`);
      }
      throw new Error(data.message || "Failed to update weapon");
    }
    throw error;
  }
}

export async function deleteWeapon(weaponId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/weapons/${weaponId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Weapon not found: ${weaponId}`);
      }
      throw new Error("Failed to delete weapon");
    }
    throw error;
  }
}

// =============================================================================
// Schtick API
// =============================================================================

export interface ListSchticksOptions {
  limit?: number;
  page?: number;
  active?: boolean;
  category?: string;
  path?: string;
}

export async function listSchticks(
  options: ListSchticksOptions = {}
): Promise<SchtickListResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());
  if (options.active !== undefined) params.append("active", options.active.toString());
  if (options.category) params.append("category", options.category);
  if (options.path) params.append("path", options.path);

  try {
    const response = await client.get(`/api/v2/schticks?${params.toString()}`);
    return {
      schticks: response.data.schticks || [],
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: 0, per_page: 25 },
      categories: response.data.categories || [],
      paths: response.data.paths || [],
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list schticks");
    }
    throw error;
  }
}

export async function getSchtick(schtickId: string): Promise<Schtick> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/schticks/${schtickId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Schtick not found: ${schtickId}`);
      }
      throw new Error("Failed to get schtick");
    }
    throw error;
  }
}

export async function createSchtick(
  schtickData: Record<string, unknown>
): Promise<Schtick> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/schticks", {
      schtick: schtickData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create schtick: ${messages}`);
      }
      throw new Error(data.message || "Failed to create schtick");
    }
    throw error;
  }
}

export async function updateSchtick(
  schtickId: string,
  schtickData: Record<string, unknown>
): Promise<Schtick> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/schticks/${schtickId}`, {
      schtick: schtickData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update schtick: ${messages}`);
      }
      throw new Error(data.message || "Failed to update schtick");
    }
    throw error;
  }
}

export async function deleteSchtick(schtickId: string): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/schticks/${schtickId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Schtick not found: ${schtickId}`);
      }
      throw new Error("Failed to delete schtick");
    }
    throw error;
  }
}

// =============================================================================
// AI API
// =============================================================================

/**
 * Generate AI images for an entity.
 * This queues a background job - images will be generated asynchronously.
 */
export async function generateEntityImage(
  entityClass: EntityClass,
  entityId: string
): Promise<AiJobResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/ai_images", {
      ai_image: {
        entity_class: entityClass,
        entity_id: entityId,
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || data.error || "Failed to generate image");
    }
    throw error;
  }
}

/**
 * Attach an image from URL to an entity.
 * GM only.
 */
export async function attachEntityImage(
  entityClass: EntityClass,
  entityId: string,
  imageUrl: string
): Promise<AiAttachResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/ai_images/attach", {
      ai_image: {
        entity_class: entityClass,
        entity_id: entityId,
        image_url: imageUrl,
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || data.error || "Failed to attach image");
    }
    throw error;
  }
}

/**
 * Create a character using AI from a description.
 * This queues a background job - the character will be created asynchronously.
 */
export async function aiCreateCharacter(
  description: string
): Promise<AiJobResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/ai", {
      ai: {
        description,
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || data.error || "Failed to create character with AI");
    }
    throw error;
  }
}

/**
 * Extend an existing character with AI-generated content.
 * This queues a background job - the character will be updated asynchronously.
 */
export async function aiExtendCharacter(
  characterId: string
): Promise<AiJobResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/ai/${characterId}/extend`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.message || data.error || "Failed to extend character with AI");
    }
    throw error;
  }
}

// =============================================================================
// Media Library API
// =============================================================================

export interface ListMediaLibraryOptions {
  status?: "orphan" | "attached";
  source?: "ai_generated" | "uploaded";
  limit?: number;
  page?: number;
}

/**
 * List images from the media library.
 * Can filter by status (orphan/attached) and source (ai_generated/uploaded).
 */
export async function listMediaLibrary(
  options: ListMediaLibraryOptions = {}
): Promise<MediaLibraryResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.status) params.append("status", options.status);
  if (options.source) params.append("source", options.source);
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());

  try {
    const response = await client.get(`/api/v2/media_library?${params.toString()}`);
    return {
      images: response.data.images || [],
      meta: response.data.meta || { page: 1, per_page: 50, total_count: 0, total_pages: 1 },
      stats: response.data.stats || { total: 0, orphan: 0, attached: 0, ai_generated: 0, uploaded: 0 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      throw new Error("Failed to list media library");
    }
    throw error;
  }
}

/**
 * Get orphan AI-generated images from the media library.
 * Convenience method for finding images that haven't been attached yet.
 */
export async function getOrphanAiImages(): Promise<MediaLibraryImage[]> {
  const response = await listMediaLibrary({
    status: "orphan",
    source: "ai_generated",
    limit: 50,
  });
  return response.images;
}

// =============================================================================
// Session Notes API (Notion Integration)
// =============================================================================

export interface SessionNotesPage {
  id: string;
  title: string;
}

export interface SessionNotesResponse {
  title: string;
  page_id: string;
  content: string;
  pages?: SessionNotesPage[];
}

/**
 * Fetch session notes from Notion by search query.
 * Searches for pages matching the query (e.g., "5-10", "session 5-10").
 */
export async function fetchSessionNotes(query: string): Promise<SessionNotesResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/notion/sessions?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`No session found matching '${query}'`);
      }
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to fetch session notes");
    }
    throw error;
  }
}

/**
 * Fetch a specific session page by ID.
 */
export async function fetchSessionById(pageId: string): Promise<SessionNotesResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/notion/sessions?id=${encodeURIComponent(pageId)}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Session not found");
      }
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to fetch session");
    }
    throw error;
  }
}

// =============================================================================
// Notion Search API
// =============================================================================

export interface NotionPage {
  id: string;
  title?: string;
  name?: string;
  url?: string;
}

/**
 * Search all Notion pages by name.
 * Uses the /notion/search endpoint which searches across all page types.
 */
export async function searchNotionPages(name: string): Promise<NotionPage[]> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/notion/search`, {
      params: { name },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to search Notion");
    }
    throw error;
  }
}

// Notification API

export interface SendNotificationParams {
  user_email?: string;
  user_id?: string;
  title: string;
  message?: string;
  type?: string;
}

/**
 * Send a notification to a campaign member.
 * Only gamemasters can send notifications, and only to members of their current campaign.
 */
export async function sendNotification(
  params: SendNotificationParams
): Promise<Notification> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post("/api/v2/notifications", {
      notification: {
        user_email: params.user_email,
        user_id: params.user_id,
        title: params.title,
        message: params.message,
        type: params.type || "gm_announcement",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to send notification");
    }
    throw error;
  }
}

// =============================================================================
// Adventure API (Notion)
// =============================================================================

export interface AdventurePage {
  id: string;
  title: string;
}

export interface AdventureResponse {
  title: string;
  page_id: string;
  content: string;
  pages?: AdventurePage[];
}

export async function fetchAdventure(query: string): Promise<AdventureResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/notion/adventures?q=${encodeURIComponent(query)}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`No adventure found matching '${query}'`);
      }
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to fetch adventure");
    }
    throw error;
  }
}

export async function fetchAdventureById(pageId: string): Promise<AdventureResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/notion/adventures?id=${encodeURIComponent(pageId)}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Adventure not found");
      }
      const data = error.response.data as ApiError;
      throw new Error(data.error || data.message || "Failed to fetch adventure");
    }
    throw error;
  }
}

// =============================================================================
// Advancement API
// =============================================================================

import type { Advancement, AdvancementListResponse } from "../types/index.js";

export interface ListAdvancementsOptions {
  limit?: number;
  page?: number;
}

export async function listAdvancements(
  characterId: string,
  options: ListAdvancementsOptions = {}
): Promise<AdvancementListResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  const params = new URLSearchParams();
  if (options.limit) params.append("per_page", options.limit.toString());
  if (options.page) params.append("page", options.page.toString());

  try {
    const queryString = params.toString();
    const url = `/api/v2/characters/${characterId}/advancements${queryString ? `?${queryString}` : ""}`;
    const response = await client.get(url);
    // API returns array directly (not wrapped in {advancements: [...]} like other endpoints)
    const advancements = Array.isArray(response.data) ? response.data : (response.data.advancements || []);
    return {
      advancements,
      meta: response.data.meta || { current_page: 1, total_pages: 1, total_count: advancements.length, per_page: 25 },
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Character not found: ${characterId}`);
      }
      throw new Error("Failed to list advancements");
    }
    throw error;
  }
}

export async function getAdvancement(
  characterId: string,
  advancementId: string
): Promise<Advancement> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.get(`/api/v2/characters/${characterId}/advancements/${advancementId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Advancement or character not found");
      }
      throw new Error("Failed to get advancement");
    }
    throw error;
  }
}

export async function createAdvancement(
  characterId: string,
  advancementData: { description?: string }
): Promise<Advancement> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.post(`/api/v2/characters/${characterId}/advancements`, {
      advancement: advancementData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error(`Character not found: ${characterId}`);
      }
      if (error.response.status === 403) {
        throw new Error("Not authorized to create advancements for this character");
      }
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to create advancement: ${messages}`);
      }
      throw new Error(data.message || "Failed to create advancement");
    }
    throw error;
  }
}

export async function updateAdvancement(
  characterId: string,
  advancementId: string,
  advancementData: { description?: string }
): Promise<Advancement> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    const response = await client.patch(`/api/v2/characters/${characterId}/advancements/${advancementId}`, {
      advancement: advancementData,
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Advancement or character not found");
      }
      if (error.response.status === 403) {
        throw new Error("Not authorized to update this advancement");
      }
      const data = error.response.data as ApiError;
      if (data.errors) {
        const messages = Object.entries(data.errors)
          .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
          .join("; ");
        throw new Error(`Failed to update advancement: ${messages}`);
      }
      throw new Error(data.message || "Failed to update advancement");
    }
    throw error;
  }
}

export async function deleteAdvancement(
  characterId: string,
  advancementId: string
): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated. Run 'chiwar login' first.");
  }

  const client = createClient(token);

  try {
    await client.delete(`/api/v2/characters/${characterId}/advancements/${advancementId}`);
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      if (error.response.status === 404) {
        throw new Error("Advancement or character not found");
      }
      if (error.response.status === 403) {
        throw new Error("Not authorized to delete this advancement");
      }
      throw new Error("Failed to delete advancement");
    }
    throw error;
  }
}
