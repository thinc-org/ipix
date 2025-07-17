import { createFileRoute } from '@tanstack/react-router'
import { S3UploadPage } from './s3-upload.tsx'

export const Route = createFileRoute('/upload/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <S3UploadPage />
}
