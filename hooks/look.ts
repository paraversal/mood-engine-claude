// Turns the theme index's roles into a Claude look (`$.theme.set({ colors })`).

import type { ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'
import type { Theme } from './themes.ts'

type Anchors = { 'surface-0': string; 'text-primary': string } & Partial<
  Record<'surface-1' | 'surface-2' | 'surface-3' | 'text-secondary' | 'text-muted', string>
>

export type Look = { theme: ThemeColors; problems: string[]; level: number }

const UNPAINTED = "Desktop won't paint"

// WCAG contrast, used to pull the theme's muted text colours far enough from
// the page that Desktop paints them. Base24 themes often keep base03/base04
// fainter than Desktop's floor.
function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(c => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function mix(from: string, to: string, t: number): string {
  const f = channels(from)
  const g = channels(to)
  return `#${f
    .map((c, i) => Math.round(c + (g[i]! - c) * t).toString(16).padStart(2, '0'))
    .join('')}`
}

/** `color` moved toward `fg` just far enough to reach `ratio` against `bg`. */
export function atLeast(color: string, bg: string, fg: string, ratio: number): string {
  if (contrast(color, bg) >= ratio) return color
  for (let t = 0.05; t < 1; t += 0.05) {
    const next = mix(color, fg, t)
    if (contrast(next, bg) >= ratio) return next
  }
  return fg
}

/** How far muted text must stand from the page, step by step. */
const LADDER = [
  { secondary: 7, muted: 4.5 },
  { secondary: 8.5, muted: 5.5 },
  { secondary: 10, muted: 7 },
  { secondary: 10, muted: 7 },
]

/**
 * The anchors for one mode, from the theme's own colours to stronger ones.
 * makeColors fills in whatever is left out.
 */
function anchorLadder(theme: Theme, mode: 'dark' | 'light'): Anchors[] {
  const r = theme.roles
  const bg = r.bg ?? theme.palette.base00 ?? '#000000'
  const fg = r.fg ?? theme.palette.base05 ?? '#ffffff'
  // Desktop wants surfaces to get lighter from surface-0 on, in both modes. A
  // dark theme's bg/surface/surface-raised are sorted darkest first (Catppuccin
  // keeps its base01 below base00); surface-3 repeats surface-2 so muted text
  // keeps its contrast on menus. A light theme's surfaces get darker, so there
  // only the page is given and the rest is derived.
  const sorted = [bg, r.surface, r['surface-raised']]
    .filter((v): v is string => v !== undefined)
    .sort((a, b) => luminance(a) - luminance(b))
  const page = mode === 'dark' ? sorted[0]! : bg
  // Each step keeps fewer of the theme's own raised surfaces: a light base02
  // leaves Desktop's highlight and status colours too little room.
  const surfaceSteps =
    mode === 'dark'
      ? [
          { 'surface-1': sorted[1], 'surface-2': sorted[2], 'surface-3': sorted[2] },
          { 'surface-1': sorted[1] },
          {},
          // Last resort: flat surfaces, all at the page colour.
          { 'surface-1': page, 'surface-2': page, 'surface-3': page },
        ]
      : [{}, {}, {}, {}]
  // The last step also lifts dim body text (Solarized's base05) toward white or
  // black. Not base07: in some light themes (Catppuccin Latte) it is a pastel.
  const last = LADDER.length - 1
  const strong = mode === 'dark' ? '#ffffff' : '#000000'

  return LADDER.map((step, i) => {
    const surfaces: Record<string, string | undefined> = surfaceSteps[i] ?? {}
    // Text is measured against every surface it sits on.
    const under = [page, ...Object.values(surfaces)].filter((v): v is string => v !== undefined)
    const against = (ratio: number, color: string | undefined) =>
      under.reduce((c, s) => atLeast(c, s, fg, ratio), color ?? fg)

    return clean({
      'surface-0': page,
      'text-primary': i === last ? atLeast(fg, page, strong, 9) : fg,
      ...surfaces,
      'text-secondary': against(step.secondary, r['fg-muted']),
      'text-muted': against(step.muted, r['fg-subtle']),
    })
  })
}

function clean(anchors: Anchors): Anchors {
  return Object.fromEntries(
    Object.entries(anchors).filter(([, v]) => v !== undefined),
  ) as Anchors
}

function roles(theme: Theme) {
  const r = theme.roles
  const p = theme.palette

  return clean2({
    accent: r.accent,
    danger: r.error,
    success: r.success,
    warning: r.warning,
    pro: p.base0E,
  })
}

function git(theme: Theme) {
  const r = theme.roles

  return clean2({ added: r.success, removed: r.error, modified: r.warning })
}

function clean2<T extends Record<string, string | undefined>>(o: T): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Record<
    string,
    string
  >
}

/**
 * One look holding the dark half from `dark` and the light half from `light`.
 * Walks down the anchor ladder until Desktop would paint it.
 */
export function buildLook(dark: Theme, light: Theme): Look {
  const darkLadder = anchorLadder(dark, 'dark')
  const lightLadder = anchorLadder(light, 'light')
  const steps = Math.max(darkLadder.length, lightLadder.length)
  let last: Look | undefined
  let error: unknown

  for (let level = 0; level < steps; level++) {
    try {
      const { theme, problems } = makeColors({
        label: dark.id === light.id ? dark.name : `${dark.name} / ${light.name}`,
        // At most 32 characters, so the pair of theme ids can't go in it.
        id: 'mood-engine',
        dark: {
          gray: { anchors: darkLadder[Math.min(level, darkLadder.length - 1)]! },
          roles: roles(dark),
          git: git(dark),
        },
        light: {
          gray: { anchors: lightLadder[Math.min(level, lightLadder.length - 1)]! },
          roles: roles(light),
          git: git(light),
        },
      })

      last = { theme, problems, level }

      if (!problems.some(line => line.startsWith(UNPAINTED))) {
        return last
      }
    } catch (thrown) {
      error = thrown
    }
  }

  if (last !== undefined) {
    return last
  }
  throw error
}

export const isUnpainted = (look: Look) => look.problems.some(l => l.startsWith(UNPAINTED))
