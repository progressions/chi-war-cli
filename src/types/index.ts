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
