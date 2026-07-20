export function resolveAppAssetSrc(assetSrc: string, base = import.meta.env.BASE_URL): string {
  if (!assetSrc.startsWith("/")) {
    return assetSrc;
  }

  return `${base.replace(/\/?$/, "/")}${assetSrc.replace(/^\/+/, "")}`;
}

export function resolveExtensionIconSrc(iconSrc: string): string {
  return resolveAppAssetSrc(iconSrc);
}
