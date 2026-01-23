'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading API Documentation...</p>
      </div>
    </div>
  ),
});

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white py-4 px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">MerchOps API</h1>
            <span className="px-2 py-1 text-xs font-medium bg-blue-600 rounded">v1.0.0</span>
          </div>
          <nav className="flex items-center space-x-4">
            <a
              href="/"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Home
            </a>
            <a
              href="/openapi.yaml"
              download
              className="text-gray-300 hover:text-white transition-colors"
            >
              Download OpenAPI Spec
            </a>
          </nav>
        </div>
      </header>
      <main>
        <SwaggerUI
          url="/openapi.yaml"
          docExpansion="list"
          defaultModelsExpandDepth={-1}
          displayRequestDuration={true}
          filter={true}
          showExtensions={true}
          tryItOutEnabled={true}
        />
      </main>
      <style jsx global>{`
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 30px 0;
        }
        .swagger-ui .info .title {
          font-size: 2rem;
          font-weight: 700;
        }
        .swagger-ui .scheme-container {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .swagger-ui .opblock-tag {
          font-size: 1.2rem;
          font-weight: 600;
        }
        .swagger-ui .opblock {
          border-radius: 8px;
          margin-bottom: 10px;
        }
        .swagger-ui .btn {
          border-radius: 6px;
        }
        .swagger-ui .parameters-col_description input {
          border-radius: 4px;
        }
        .swagger-ui .response-col_status {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
