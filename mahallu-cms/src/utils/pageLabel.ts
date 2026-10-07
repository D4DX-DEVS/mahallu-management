/** "ChangeRequestsList" -> "Change Requests", "CreateFamily" -> "New Family". */
export function humanizePageName(componentName: string): string {
  const splitWords = (s: string) =>
    s
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim();

  if (componentName.startsWith('Create')) {
    return `New ${splitWords(componentName.slice('Create'.length))}`;
  }
  if (componentName.endsWith('List')) {
    return splitWords(componentName.slice(0, -'List'.length));
  }
  return splitWords(componentName);
}

/**
 * Fallback label for a route registered without an explicit `label`, derived
 * from its URL so it survives minification: "/mahallu-finance/ledger-items" ->
 * "Ledger Items", ".../create" -> "New <parent>".
 */
export function labelFromPath(path: string): string {
  const title = (segment: string) =>
    segment
      .split('-')
      .filter(Boolean)
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ');
  const segments = path.split('/').filter((segment) => segment && !segment.startsWith(':'));
  const last = segments[segments.length - 1];
  if (!last) return 'Home';
  if (last === 'create') return segments.length > 1 ? `New ${title(segments[segments.length - 2])}` : 'New';
  return title(last);
}
