// SPDX-License-Identifier: AGPL-3.0-only
// The product name a person sees, changed at build time.
//
// Why: COMMERCIAL.md says the ScanRuler and CNC Kitchen names and logo are
// trademarks and "Forks must use a different name". So the visible name
// changes and nothing else does. What has to keep saying ScanRuler still does:
// the project file format (so files open in both apps), what the tools report,
// and the credit to the author.

export const FORK_NAME = 'PartBench'
export const FORK_URL = 'https://github.com/Teakzieas/partbench'

/** Interface files only: never the core, the commands or the file formats. */
const INTERFACE = /[\\/](src[\\/]ui|plugins[\\/][^\\/]+[\\/]ui)[\\/][^\\/]+\.tsx$/
/** The author's own words stay: the card asking people to support the author,
 *  and the imprint, which is a legal notice. */
const LEAVE_ALONE = /[\\/](SupportCard|Imprint)\.tsx$/

export const shouldRebrand = (file) => INTERFACE.test(file) && !LEAVE_ALONE.test(file)

/** A file's source with the visible product name changed. */
export function rebrand(code) {
  const CREDIT = '\u0000credit\u0000'
  return code
    .replace("'ScanRuler by CNC Kitchen'", `'${FORK_NAME}'`)
    .replace('CNC Kitchen · 3D scan analysis', `${CREDIT} · 3D scan analysis`)
    .replace("'https://github.com/CNCKitchen/scanruler'", `'${FORK_URL}'`)
    .replace(/\bScanRuler\b/g, FORK_NAME)
    .replace(CREDIT, 'Based on ScanRuler by CNC Kitchen')
}

/** index.html with the visible product name changed, the credit kept. */
export function rebrandHtml(html) {
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${FORK_NAME}</title>`)
    .replace('ScanRuler by CNC Kitchen —', `${FORK_NAME}, based on ScanRuler by CNC Kitchen —`)
}
