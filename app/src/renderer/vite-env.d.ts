/// <reference types="vite/client" />

import type { MonkeyPlayApi } from "../preload";

declare global {
  interface Window {
    monkeyplay: MonkeyPlayApi;
  }
}

