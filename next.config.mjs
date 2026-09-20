/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // PDF.js must run in Node; bundling its ESM runtime breaks PDF attachments.
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
    outputFileTracingIncludes: {
      '/api/fixed-documents': ['./templates/ende/*.docx', './node_modules/@napi-rs/canvas*/**/*'],
      '/api/evaluation': ['./node_modules/@napi-rs/canvas*/**/*'],
    },
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
