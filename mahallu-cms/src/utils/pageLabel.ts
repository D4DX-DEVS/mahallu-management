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
