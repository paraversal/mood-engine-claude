// The theme-index reader protocol (mood-engine's skills/themes/SKILL.md),
// written against plain inputs so it tests without a filesystem.

export type Appearance = 'dark' | 'light'
export type Selection = Partial<Record<Appearance, string>>

export type Scheme = {
  name?: string
  variant?: Appearance
  palette: Record<string, string>
  roles?: Record<string, string>
}

export type Theme = {
  id: string
  name: string
  variant: Appearance
  palette: Record<string, string>
  roles: Record<string, string>
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Merge roles.json with the scheme's own roles and resolve each to a hex colour. */
export function loadTheme(id: string, scheme: Scheme, baseRoles: Record<string, string>): Theme {
  const merged = { ...baseRoles, ...(scheme.roles ?? {}) }
  const roles: Record<string, string> = {}

  for (const [role, value] of Object.entries(merged)) {
    const hex = value.startsWith('#') ? value : scheme.palette[value]

    if (hex !== undefined && HEX.test(hex)) {
      roles[role] = hex.toLowerCase()
    }
  }

  return {
    id,
    name: scheme.name ?? id,
    variant: scheme.variant === 'light' ? 'light' : 'dark',
    palette: scheme.palette,
    roles,
  }
}

/**
 * Which theme id an appearance uses: current.json, then defaults.json, then the
 * first listed theme of that variant, then the first listed theme.
 */
export function chooseId(
  appearance: Appearance,
  ids: readonly string[],
  variants: Readonly<Record<string, Appearance>>,
  current: Selection,
  defaults: Selection,
): string | undefined {
  for (const pick of [current[appearance], defaults[appearance]]) {
    if (pick !== undefined && ids.includes(pick)) {
      return pick
    }
  }

  return ids.find(id => variants[id] === appearance) ?? ids[0]
}
