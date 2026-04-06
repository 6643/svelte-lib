const isBareRelativeHref = (raw: string): boolean => !raw.startsWith('/') && !raw.startsWith('?') && !raw.startsWith('#') && !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw);
const hasUnsupportedAbsoluteScheme = (raw: string): boolean => /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) && !/^https?:/i.test(raw);
const normalizeResolvedTarget = (pathname: string, search: string, target: string): string => {
  if (pathname.startsWith('//')) {
    throw new Error(`Navigation target must not resolve to a pathname starting with //: ${target}`);
  }

  return search ? `${pathname}${search}` : pathname;
};

export const normalizeNavigationTarget = (target: string, currentPath: string, origin: string): string => {
  if (target.startsWith('#')) {
    return currentPath;
  }

  if (target === '?') {
    return normalizeResolvedTarget(currentPath.split('?')[0] || '/', '', target);
  }

  if (target.startsWith('?')) {
    const pathname = currentPath.split('?')[0] || '/';
    const url = new URL(`${pathname}${target}`, origin);
    return normalizeResolvedTarget(url.pathname, url.search, target);
  }

  if (target.startsWith('/')) {
    const url = new URL(target, origin);
    if (url.origin !== origin) {
      throw new Error(`Cross-origin navigation is not supported: ${target}`);
    }

    return normalizeResolvedTarget(url.pathname, url.search, target);
  }

  if (isBareRelativeHref(target)) {
    throw new Error(`Relative navigation is not supported: ${target}`);
  }

  const url = new URL(target);
  if (url.origin !== origin) {
    throw new Error(`Cross-origin navigation is not supported: ${target}`);
  }

  return normalizeResolvedTarget(url.pathname, url.search, target);
};

export const getRawAnchorNavigationTarget = (anchor: HTMLAnchorElement): string | null => {
  const raw = anchor.getAttribute('href');

  if (!raw || raw.startsWith('#') || isBareRelativeHref(raw) || hasUnsupportedAbsoluteScheme(raw)) {
    return null;
  }

  return raw;
};
