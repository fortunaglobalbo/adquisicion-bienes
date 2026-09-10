/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // PDF.js must run in Node; bundling its ESM runtime breaks PDF attachments.
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
    outputFileTracingIncludes: {
      '/api/fixed-documents': ['./templates/ende/*.docx'],
    },
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
