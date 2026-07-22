import DocumentStudioEditor from '@/components/documents/DocumentStudioEditor'

export default function EditDocumentStudioPage({ params }: { params: { id: string } }) {
  return <DocumentStudioEditor documentId={params.id} />
}
