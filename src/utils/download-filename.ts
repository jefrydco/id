export function createDownloadFilename(name: string): string {
  const timestamp = Date.now()
  return `jefrydco.${timestamp}.${name}`
}
