export type CharacterType =
  | "pc"
  | "npc"
  | "featured_foe"
  | "boss"
  | "uber_boss"
  | "mook"
  | "ally";

export interface Character {
  id: string;
  name: string;
  character_type: CharacterType;
  active: boolean;
  wounds: number;
  max_wounds: number;
  impairments: number;
  defense: number;
  speed: number;
  toughness: number;
  fortune: number;
  max_fortune: number;
  description?: string;
  campaign_id: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  gamemaster?: boolean;
}

export interface Config {
  token?: string;
  apiUrl: string;
  currentCampaignId?: string;
}

export interface SignInResponse {
  user: User;
  token: string;
}

export interface CreateCharacterParams {
  name: string;
  character_type: CharacterType;
  wounds?: number;
  defense?: number;
  speed?: number;
  toughness?: number;
  fortune?: number;
  description?: string;
}
