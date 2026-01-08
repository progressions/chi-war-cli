export type CharacterType =
  | "pc"
  | "npc"
  | "featured_foe"
  | "boss"
  | "uber_boss"
  | "mook"
  | "ally";

export interface ActionValues {
  Type?: string;           // PC, NPC, Ally, Mook, Featured Foe, Boss, Uber-Boss
  Guns?: number;
  "Martial Arts"?: number;
  Sorcery?: number;
  Scroungetech?: number;
  Creature?: number;
  Mutant?: number;
  Defense?: number;
  Toughness?: number;
  Speed?: number;
  Fortune?: number;
  "Max Fortune"?: number;
  Wounds?: number;
  MainAttack?: string;
  SecondaryAttack?: string | null;
  Archetype?: string;
  Damage?: number;
  FortuneType?: string;
  [key: string]: unknown;  // Allow other custom fields
}

export interface Character {
  id: string;
  name: string;
  active: boolean;
  action_values?: ActionValues;
  description?: Record<string, string>;
  summary?: string;
  campaign_id: string;
  faction_id?: string;
  juncture_id?: string;
  user_id?: string;
  is_template?: boolean;
  impairments?: number;
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

export interface Party {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  faction_id?: string;
  campaign_id: string;
  juncture_id?: string;
  character_ids: string[];
  vehicle_ids: string[];
  created_at: string;
  updated_at: string;
  image_url?: string;
  characters?: Array<{ id: string; name: string; image_url?: string }>;
  vehicles?: Array<{ id: string; name: string }>;
  faction?: { id: string; name: string };
  juncture?: { id: string; name: string };
  slots?: PartySlot[];
  has_composition?: boolean;
}

export interface PartySlot {
  id: string;
  role: string;
  character_id?: string;
  vehicle_id?: string;
  default_mook_count?: number;
  position?: number;
  character?: { id: string; name: string; image_url?: string; action_values?: ActionValues };
  vehicle?: { id: string; name: string };
}
