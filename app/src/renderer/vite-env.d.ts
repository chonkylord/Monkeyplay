/// <reference types="vite/client" />

import type { ChunkyPlayApi } from "../preload";

declare global {
  interface Window {
    chunkyplay: ChunkyPlayApi;
  }
}

