import type { EngineInterface, Register } from 'claude-code'

import { buildLook, isUnpainted, type Look } from './look.ts'
import { chooseId, loadTheme, type Appearance, type Scheme, type Selection, type Theme } from './themes.ts'

type $ = EngineInterface

/** How often the theme files are checked for a switch. There is no file watcher. */
const POLL_MS = 1500

type Dirs = { themes: string; state: string }

type Applied = {
  dark: Theme
  light: Theme
  look: Look
  isDrawn: boolean
  reason?: string
}

async function dirs($: $): Promise<Dirs> {
  const home = (await $.env.get('HOME')) ?? ''
  const config = (await $.env.get('XDG_CONFIG_HOME')) ?? `${home}/.config`
  const state = (await $.env.get('XDG_STATE_HOME')) ?? `${home}/.local/state`

  return {
    themes: (await $.env.get('THEMES_DIR')) ?? `${config}/themes`,
    state: (await $.env.get('THEMES_STATE_DIR')) ?? `${state}/themes`,
  }
}

async function readJson<T>($: $, path: string): Promise<T | undefined> {
  try {
    return JSON.parse((await $.fs.read(path)) as string) as T
  } catch {
    return undefined
  }
}

async function mtime($: $, path: string): Promise<number> {
  try {
    return (await $.fs.stat(path)).mtimeMs
  } catch {
    return 0
  }
}

/** Reads the index and picks the dark and light themes, as SKILL.md's reader does. */
async function resolve($: $, d: Dirs) {
  const schemesDir = `${d.themes}/schemes`
  const entries = await $.fs.list(schemesDir)
  const schemes: Record<string, Scheme> = {}

  for (const entry of entries) {
    if (!entry.name.endsWith('.json')) continue
    const scheme = await readJson<Scheme>($, `${schemesDir}/${entry.name}`)

    if (scheme?.palette !== undefined) {
      schemes[entry.name.slice(0, -5)] = scheme
    }
  }

  const ids = Object.keys(schemes).sort()
  const variants = Object.fromEntries(
    ids.map(id => [id, schemes[id]!.variant === 'light' ? 'light' : 'dark'] as const),
  )
  const current = (await readJson<Selection>($, `${d.state}/current.json`)) ?? {}
  const defaults = (await readJson<Selection>($, `${d.themes}/defaults.json`)) ?? {}
  const baseRoles = (await readJson<Record<string, string>>($, `${d.themes}/roles.json`)) ?? {}

  const pick = (appearance: Appearance) => {
    const id = chooseId(appearance, ids, variants, current, defaults)

    return id === undefined ? undefined : loadTheme(id, schemes[id]!, baseRoles)
  }

  return { dark: pick('dark'), light: pick('light'), ids, schemesDir }
}

/** Every file whose change can change the result. stat follows symlinks into dotfiles. */
async function fingerprint($: $, d: Dirs, ids: readonly string[], schemesDir: string) {
  const paths = [
    `${d.state}/current.json`,
    `${d.themes}/defaults.json`,
    `${d.themes}/roles.json`,
    ...ids.map(id => `${schemesDir}/${id}.json`),
  ]
  const times = await Promise.all(paths.map(p => mtime($, p)))

  return `${ids.join(',')}|${times.join(',')}`
}

// Module state: a reload starts it over, and session.start re-applies.
let applied: Applied | undefined
let lastError: string | undefined
let seen = ''

async function apply($: $, d: Dirs): Promise<void> {
  const { dark, light } = await resolve($, d)

  if (dark === undefined || light === undefined) {
    lastError = `no themes found in ${d.themes}/schemes`
    return
  }
  const look = buildLook(dark, light)

  // Recorded first, so /mood can say what was picked even where no surface
  // offers $.theme (the test runner) or the set fails.
  applied = { dark, light, look, isDrawn: false, reason: 'not set yet' }
  lastError = undefined

  let set
  try {
    set = await $.theme.set({ colors: look.theme })
  } catch (thrown) {
    applied.reason = `could not set the look: ${thrown instanceof Error ? thrown.message : String(thrown)}`
    return
  }

  applied = set.isDrawn
    ? { dark, light, look, isDrawn: true }
    : { dark, light, look, isDrawn: false, reason: set.reason }
}

async function check($: $, d: Dirs, force = false): Promise<void> {
  try {
    const { ids, schemesDir } = await resolve($, d)
    const now = await fingerprint($, d, ids, schemesDir)

    if (!force && now === seen) return
    seen = now
    await apply($, d)
  } catch (thrown) {
    lastError = thrown instanceof Error ? thrown.message : String(thrown)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const d = await dirs($)

    await $.command.register({
      name: 'mood',
      description: 'Re-apply the mood-engine theme and show which themes are in use',
    })
    await check($, d, true)
    $.clock.every(POLL_MS, () => check($, d))

    return next(e)
  })

  on('command.run', { command: 'mood' }, async $ => {
    await check($, await dirs($), true)

    if (applied === undefined) {
      return { text: `mood-engine: nothing applied. ${lastError ?? ''}`.trim() }
    }
    const { dark, light, look, isDrawn, reason } = applied
    const lines = [
      `dark: ${dark.name} (${dark.id})`,
      `light: ${light.name} (${light.id})`,
      isDrawn ? 'Drawn by the attached app.' : `Not drawn here: ${reason}`,
    ]

    if (look.level > 0) {
      lines.push(`Simplified mapping (level ${look.level}) so Desktop paints it.`)
    }
    if (isUnpainted(look)) {
      lines.push(...look.problems.filter(l => l.startsWith("Desktop won't paint")))
    }
    if (lastError !== undefined) {
      lines.push(`Last error: ${lastError}`)
    }

    return { text: lines.join('\n') }
  })
}
