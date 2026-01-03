export function getHeaders(source) {
  if (!source) {
    return null;
  }

  if (source.headers) {
    return source.headers;
  }

  return source;
}

export function getHeader(source, name) {
  const headers = getHeaders(source);
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  return headers[name] || headers[name.toLowerCase()] || null;
}
