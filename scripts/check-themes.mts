// Builds the look for every dark/light pair in ~/.config/themes and says whether
// Claude Desktop would paint it. Run: node scripts/check-themes.mts
import { readFileSync, readdirSync } from 'node:fs'
import { loadTheme } from '../hooks/themes.ts'
import { buildLook, isUnpainted } from '../hooks/look.ts'
const dir = process.env.THEMES_DIR ?? (process.env.HOME + '/.config/themes')
const roles = JSON.parse(readFileSync(dir + '/roles.json', 'utf8'))
const themes = readdirSync(dir + '/schemes').map(f => loadTheme(f.slice(0, -5), JSON.parse(readFileSync(dir + '/schemes/' + f, 'utf8')), roles))
const darks = themes.filter(t => t.variant === 'dark'), lights = themes.filter(t => t.variant === 'light')
for (const d of darks) for (const l of lights) {
  try { const look = buildLook(d, l); console.log(d.id.padEnd(18), l.id.padEnd(20), 'level', look.level, isUnpainted(look) ? 'UNPAINTED' : 'ok', look.problems.length, 'notes')
    if (isUnpainted(look)) console.log('   ', look.problems.filter(p => p.startsWith("Desktop")).join('\n    ')) }
  catch (e) { console.log(d.id, l.id, 'THREW', String(e).slice(0, 300)) }
}
