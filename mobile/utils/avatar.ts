const ADJECTIVES = [
  'Vapor', 'Static', 'Quantum', 'Phantom', 'Obsidian',
  'Cyber', 'Liquid', 'Neon', 'Spectral', 'Sonic',
  'Astral', 'Plasma', 'Crypto', 'Glitch', 'Neural',
  'Cosmic', 'Solar', 'Veloc', 'Carbon', 'Hydra',
  'Binary', 'Atomic', 'Isotope', 'Prism', 'Apex',
  'Ember', 'Helix', 'Nexus', 'Vertex', 'Zephyr'
];

const NOUNS = [
  'Ghost', 'Echo', 'Pulsar', 'Nomad', 'Vibe',
  'Daemon', 'Ranger', 'Spectre', 'Spire', 'Vector',
  'Matrix', 'Warden', 'Aura', 'Nova', 'Pulse',
  'Catalyst', 'Cypher', 'Sentinel', 'Rebel', 'Grid',
  'Frequency', 'Eclipse', 'Orbit', 'Flux', 'Drifter',
  'Hazard', 'Phantom', 'Beacon', 'Siren', 'Helix'
];

export interface Gradient {
  start: string;
  end: string;
}

const GRADIENTS: Gradient[] = [
  { start: '#6A4CF5', end: '#D44DF0' }, // Violet Glow
  { start: '#FF5577', end: '#FF7A3D' }, // Crimson Sunset
  { start: '#0099FF', end: '#4ECDC4' }, // Electric Cyan
  { start: '#F1C40F', end: '#E67E22' }, // Golden Aurora
  { start: '#2ECC71', end: '#1ABC9C' }, // Emerald Mint
  { start: '#FF007F', end: '#7B1FA2' }, // Cyber Magenta
];

export interface SpectralProfile {
  alias: string;
  gradient: Gradient;
  initials: string;
}

/**
 * Deterministically generates a Spectral Profile (Pseudonym & Gradient colors) based on a SHA-256 hash.
 */
export function getSpectralProfile(hash: string | null | undefined): SpectralProfile {
  if (!hash) {
    return {
      alias: 'Ghost Chat',
      gradient: { start: '#374151', end: '#1F2937' }, // Slate gray fallback
      initials: '💀',
    };
  }

  // Parse the first 8 characters of the SHA-256 hash as an integer
  const hexPart = hash.slice(0, 8);
  const intVal = parseInt(hexPart, 16) || 0;

  const adj = ADJECTIVES[intVal % ADJECTIVES.length];
  const noun = NOUNS[(intVal >>> 4) % NOUNS.length];
  const gradient = GRADIENTS[(intVal >>> 8) % GRADIENTS.length];

  const alias = `${adj} ${noun}`;
  const initials = `${adj.slice(0, 1)}${noun.slice(0, 1)}`.toUpperCase();

  return {
    alias,
    gradient,
    initials,
  };
}
