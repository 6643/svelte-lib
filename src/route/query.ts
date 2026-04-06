import type { RouteDecoder, RouteDecoderMap } from './types.ts';

export const decodeQueryValue = (raw: string | null, decoder: RouteDecoder): unknown => {
  if (decoder === String) {
    return raw ?? undefined;
  }

  if (decoder === Number) {
    if (raw == null || raw === '') {
      return undefined;
    }

    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }

  if (decoder === Boolean) {
    if (raw === 'true') {
      return true;
    }

    if (raw === 'false') {
      return false;
    }

    return undefined;
  }

  return decoder(raw);
};

export const decodeRouteProps = (search: string, decoders: RouteDecoderMap): Record<string, unknown> => {
  const params = new URLSearchParams(search);
  const output = Object.create(null) as Record<string, unknown>;

  for (const key in decoders) {
    const name = key.slice(1);
    output[name] = decodeQueryValue(params.get(name), decoders[key as keyof RouteDecoderMap]);
  }

  return output;
};
