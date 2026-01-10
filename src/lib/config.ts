import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import type { Config } from "../types/index.js";

const CONFIG_DIR = join(homedir(), ".chiwar");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: Config = {
  apiUrl: "https://shot-elixir.fly.dev",
};

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    const stored = JSON.parse(content) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getToken(): string | null {
  const config = loadConfig();
  return config.token ?? null;
}

export function setToken(token: string): void {
  const config = loadConfig();
  config.token = token;
  saveConfig(config);
}

export function clearToken(): void {
  const config = loadConfig();
  delete config.token;
  saveConfig(config);
}

export function getApiUrl(): string {
  return loadConfig().apiUrl;
}

export function setApiUrl(url: string): void {
  const config = loadConfig();
  config.apiUrl = url;
  saveConfig(config);
}

export function getCurrentCampaignId(): string | null {
  return loadConfig().currentCampaignId ?? null;
}

export function setCurrentCampaignId(campaignId: string | undefined): void {
  const config = loadConfig();
  if (campaignId === undefined) {
    delete config.currentCampaignId;
  } else {
    config.currentCampaignId = campaignId;
  }
  saveConfig(config);
}

export function getCurrentEncounterId(): string | null {
  const config = loadConfig() as Config & { currentEncounterId?: string };
  return config.currentEncounterId ?? null;
}

export function setCurrentEncounterId(encounterId: string | undefined): void {
  const config = loadConfig() as Config & { currentEncounterId?: string };
  if (encounterId === undefined) {
    delete config.currentEncounterId;
  } else {
    config.currentEncounterId = encounterId;
  }
  saveConfig(config as Config);
}
