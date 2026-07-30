import { serviceRole } from '@/lib/apiAuth'
import type { TaskAttachment } from '@/lib/taskAttachmentTypes'

export {
  detectTaskImageMime,
  extensionForTaskImage,
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENT_LABEL,
  MAX_TASK_ATTACHMENTS,
  TASK_ATTACHMENT_MIME_TYPES,
} from '@/lib/taskAttachmentTypes'

export async function attachTaskImageUrls<T extends { attachments?: TaskAttachment[] | null }>(tasks: T[]) {
  const db = serviceRole()
  const all = tasks.flatMap(task => task.attachments ?? [])
  if (all.length === 0) return tasks

  const { data } = await db.storage
    .from('task-attachments')
    .createSignedUrls(all.map(attachment => attachment.storage_path), 60 * 60)
  const urlsByPath = new Map((data ?? []).map(item => [item.path, item.signedUrl]))

  return tasks.map(task => ({
    ...task,
    attachments: (task.attachments ?? []).map(attachment => ({
      ...attachment,
      signed_url: urlsByPath.get(attachment.storage_path) ?? null,
    })),
  }))
}
