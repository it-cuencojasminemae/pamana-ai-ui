/** Keep stored report categories unchanged while displaying readable titles. */
export function formatReportTitle(value: string): string {
  return value.trim().replace(/[_-]+/g, ' ').toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase())
}
