import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function loadLocalEnv() {
  try {
    const raw = await fs.readFile(path.join(projectRoot, '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (!match || process.env[match[1]]) continue
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // Launchd can also provide the variables directly.
  }
}

await loadLocalEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const archiveRoot = process.env.MESH_ARCHIVE_ROOT || path.join(
  os.homedir(),
  'Documents',
  'AL SAAD GROUP',
  'MeahMedia Documents',
  'MESH MEDIA DOCUMENTS',
)
const stateDir = path.join(os.homedir(), 'Library', 'Application Support', 'MeshMedia Archive')
const statePath = path.join(stateDir, 'state.json')
const folders = {
  invoice: 'INVOICES',
  quotation: 'QUOTATION',
  agency_document: 'DOCUMENT STUDIO',
}

await fs.mkdir(stateDir, { recursive: true })
for (const folder of Object.values(folders)) {
  await fs.mkdir(path.join(archiveRoot, folder), { recursive: true })
}

let state = { hashes: {} }
try {
  state = JSON.parse(await fs.readFile(statePath, 'utf8'))
} catch {
  // First run starts with an empty manifest and safely backfills existing archives.
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data: archives, error } = await db
  .from('document_archives')
  .select('entity_type, entity_id, file_name, storage_path, sha256, generated_at')
  .order('generated_at', { ascending: true })
  .limit(2000)
if (error) throw error

let synced = 0
for (const archive of archives ?? []) {
  const key = `${archive.entity_type}:${archive.entity_id}`
  if (state.hashes[key] === archive.sha256) continue

  const folder = folders[archive.entity_type]
  if (!folder) continue
  const { data, error: downloadError } = await db.storage
    .from('document-archive')
    .download(archive.storage_path)
  if (downloadError) throw downloadError

  const destination = path.join(archiveRoot, folder, path.basename(archive.file_name))
  const temporary = `${destination}.downloading`
  await fs.writeFile(temporary, Buffer.from(await data.arrayBuffer()))
  await fs.rename(temporary, destination)
  state.hashes[key] = archive.sha256
  synced += 1
}

await fs.writeFile(statePath, JSON.stringify(state, null, 2))
console.log(`MeshMedia archive sync complete: ${synced} file(s) updated.`)
