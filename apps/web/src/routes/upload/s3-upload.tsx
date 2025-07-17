import { STSUploadExample } from './sts-upload-example'
// import { InlineUploadExample } from './inline-upload-example'

// Import Uppy styles
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'

export function S3UploadPage() {
  // Initialize Uppy instance only on client side

  // Cleanup on unmount

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            File Upload
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload your files directly to AWS S3 with multipart support for large files
          </p>
        </div>

        {/* STS Token Info and Alternative Upload */}
        <div className="space-y-4">
          <STSUploadExample />
        </div>

        {/* Features Info */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Multipart Upload
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Large files ({'>'}50MB) are automatically uploaded using multipart for better performance and reliability.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              Direct to S3
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Files are uploaded directly to AWS S3, reducing server load and improving upload speeds.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              File Metadata
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add custom metadata like descriptions and tags to organize your uploads.
            </p>
          </div>
        </div>

{/*         { Alternative Upload Methods }
        <div className="space-y-6">  
          <div className="grid lg:grid-cols-2 gap-6">
            <InlineUploadExample />
          </div>
        </div> */}

      </div>
    </div>
  )
}
