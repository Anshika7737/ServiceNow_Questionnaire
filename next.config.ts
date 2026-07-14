import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingExcludes: {
    "*": ["python-extractor/.venv/**", ".python-venv/**"],
  },
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "tesseract.js",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;
