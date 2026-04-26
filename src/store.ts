import { Store } from "@tauri-apps/plugin-store";

// Lazily loaded singleton store backed by a JSON file in the app's data dir.
// This file is shared between dev and production builds, so data persists
// across installs and is available the same way in both environments.
let _store: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!_store) {
    _store = Store.load("git-ui.json", { autoSave: false, defaults: {} });
  }
  return _store;
}

export async function storeGet<T>(key: string): Promise<T | null> {
  try {
    const store = await getStore();
    return (await store.get<T>(key)) ?? null;
  } catch {
    return null;
  }
}

export async function storeSet(key: string, value: unknown): Promise<void> {
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  } catch {
    // ignore - worst case the value just isn't persisted
  }
}
