/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_R2_PUBLIC_BASE_WITH_BUCKET?: string;
  readonly VITE_R2_PUBLIC_BASE_URL?: string;
  readonly VITE_R2_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
