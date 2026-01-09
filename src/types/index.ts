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

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  gamemaster_id: string;
  current_fight_id?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginationMeta {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  meta: PaginationMeta;
}

export interface Shot {
  id: string;
  shot: number;
  character_id?: string;
  vehicle_id?: string;
  fight_id: string;
  character?: {
    id: string;
    name: string;
    action_values?: ActionValues;
    image_url?: string;
  };
  vehicle?: {
    id: string;
    name: string;
  };
}

export interface Fight {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  ended: boolean;
  sequence: number;
  campaign_id: string;
  site_id?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  shots?: Shot[];
  site?: { id: string; name: string };
}

export interface FightListResponse {
  fights: Fight[];
  meta: PaginationMeta;
}

export interface SiteAttunement {
  id: string;
  character_id: string;
  site_id: string;
  character?: {
    id: string;
    name: string;
    image_url?: string;
  };
}

export interface Site {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  feng_shui_value?: number;
  campaign_id: string;
  juncture_id?: string;
  faction_id?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  juncture?: { id: string; name: string };
  faction?: { id: string; name: string };
  attunements?: SiteAttunement[];
}

export interface SiteListResponse {
  sites: Site[];
  meta: PaginationMeta;
}

export interface Juncture {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  campaign_id: string;
  start_year?: number;
  end_year?: number;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface JunctureListResponse {
  junctures: Juncture[];
  meta: PaginationMeta;
}

export interface VehicleActionValues {
  Acceleration?: number;
  Handling?: number;
  Frame?: number;
  Squeal?: number;
  Crunch?: number;
  Condition?: number;
  [key: string]: unknown;
}

export interface Vehicle {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  campaign_id: string;
  action_values?: VehicleActionValues;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  meta: PaginationMeta;
}

export interface Weapon {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  campaign_id: string;
  character_id?: string;
  damage?: number;
  concealment?: number;
  reload?: number;
  juncture_id?: string;
  category?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  character?: { id: string; name: string };
  juncture?: { id: string; name: string };
}

export interface WeaponListResponse {
  weapons: Weapon[];
  meta: PaginationMeta;
}

export interface Schtick {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  campaign_id: string;
  category?: string;
  path?: string;
  color?: string;
  bonus?: boolean;
  archetypes?: string[];
  prerequisite_id?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  prerequisite?: { id: string; name: string; category?: string };
}

export interface SchtickListResponse {
  schticks: Schtick[];
  meta: PaginationMeta;
  categories: string[];
  paths: string[];
}

// AI types
export type EntityClass =
  | "Character"
  | "Vehicle"
  | "Party"
  | "Faction"
  | "Site"
  | "Weapon"
  | "Schtick"
  | "Fight"
  | "Campaign";

export interface AiJobResponse {
  message: string;
}

export interface AiImageParams {
  entity_class: EntityClass;
  entity_id: string;
}

export interface AiImageAttachParams {
  entity_class: EntityClass;
  entity_id: string;
  image_url: string;
}

export interface AiCreateParams {
  description: string;
}

export interface AiAttachResponse {
  entity: Record<string, unknown>;
  serializer: string;
}

// Media Library types
export interface MediaLibraryImage {
  id: string;
  status: "orphan" | "attached";
  source: "ai_generated" | "uploaded";
  imagekit_url: string;
  entity_type: EntityClass | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaLibraryResponse {
  images: MediaLibraryImage[];
  meta: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
  stats: {
    total: number;
    orphan: number;
    attached: number;
    ai_generated: number;
    uploaded: number;
  };
}
