import { expect, test } from 'claude-code/testing'

// A small theme index, served through mocked fs/env calls (tests have no fs).
const HOME = '/home/t'
const FILES: Record<string, unknown> = {
  [`${HOME}/.config/themes/roles.json`]: {
    bg: 'base00', surface: 'base01', 'surface-raised': 'base02',
    fg: 'base05', 'fg-muted': 'base04', 'fg-subtle': 'base03',
    accent: 'base0D', success: 'base0B', warning: 'base0A', error: 'base08',
  },
  [`${HOME}/.config/themes/defaults.json`]: { dark: 'night', light: 'day' },
  [`${HOME}/.local/state/themes/current.json`]: { dark: 'night' },
  [`${HOME}/.config/themes/schemes/night.json`]: {
    name: 'Night', variant: 'dark',
    palette: palette(['#111111', '#1c1c1c', '#262626', '#7a7a7a', '#a0a0a0', '#e0e0e0', '#f0f0f0', '#ffffff']),
  },
  [`${HOME}/.config/themes/schemes/day.json`]: {
    name: 'Day', variant: 'light',
    palette: palette(['#fafafa', '#eeeeee', '#e0e0e0', '#8a8a8a', '#5a5a5a', '#202020', '#101010', '#000000']),
  },
}

function palette(grays: string[]): Record<string, string> {
  const hues = ['#c0392b', '#d35400', '#b7950b', '#2e7d32', '#00838f', '#1565c0', '#6a1b9a', '#795548']
  const p: Record<string, string> = {}
  const keys = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '0A', '0B', '0C', '0D', '0E', '0F', '10', '11', '12', '13', '14', '15', '16', '17']
  keys.forEach((k, i) => {
    p[`base${k}`] = i < 8 ? grays[i]! : i < 16 ? hues[i - 8]! : i < 18 ? grays[0]! : hues[i - 18]!
  })
  return p
}

test('applies the dark and light themes as one look, and /mood reports them', async ($, on) => {
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('fs.read', (_, e) => {
    const file = FILES[e.path]
    if (file === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: JSON.stringify(file) }
  })
  on('fs.list', () => ({
    value: [
      { name: 'day.json', kind: 'file', size: 1, mtimeMs: 1, isLink: false },
      { name: 'night.json', kind: 'file', size: 1, mtimeMs: 1, isLink: false },
    ],
  }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false } }))
  on('clock.every', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'mood' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const { text } = await $.command.run({ command: 'mood' })
  expect(text).toContain('dark: Night (night)')
  expect(text).toContain('light: Day (day)')
  expect(text).not.toContain('nothing applied')
  expect(text).not.toContain("Desktop won't paint")
})
