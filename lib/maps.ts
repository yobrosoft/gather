import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configuredKey = "";

export function configureMaps(key: string) {
  if (!key || configuredKey === key) return;
  try {
    setOptions({ key, v: "weekly" });
  } catch {
    /* The loader accepts options once. */
  }
  configuredKey = key;
}

export async function loadMapsLibrary<T extends keyof google.maps.ImportLibraryMap>(name: T) {
  return importLibrary(name);
}
