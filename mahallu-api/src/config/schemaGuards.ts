import mongoose, { Schema } from 'mongoose';

/**
 * A ceiling on every string the database will store.
 *
 * Across 45 schemas there were two `maxlength` declarations. Everything else —
 * names, notes, descriptions, remarks, addresses — was an unbounded `String`,
 * so whatever got past the route layer was written as-is. A single document can
 * hold 16 MB, which is 16 MB of a report to render, of an export to build, and
 * of a list response to send to a phone.
 *
 * Route-level rules are where a *useful* limit lives: 100 characters for a
 * name, 300 for remarks, with copy that says so. This is the floor underneath
 * them — the answer to "what if a write reaches the model without passing one",
 * which is what a script, a migration, a seeder or a route someone adds next
 * year all do.
 *
 * The cap is deliberately far above any real value. It is not a validation
 * rule; it is the point past which the input stopped being data.
 *
 * Registered as a global plugin, so it must run before any schema is compiled.
 * `index.ts` imports this module first for exactly that reason.
 */

/** ~10k characters: longer than any field in this product, shorter than a payload. */
const DEFAULT_MAX_STRING = 10_000;

/** Fields that legitimately hold a long body of text get a higher ceiling. */
const LONG_TEXT_PATHS = new Set([
  'body',
  'description',
  'proposal',
  'completionReport',
  'minutes',
  'agenda',
  'content',
  'criteria',
  'sessionNotes',
  'purposeDescription',
]);

const LONG_TEXT_MAX = 50_000;

export const capStrings = (schema: Schema) => {
  schema.eachPath((path, type) => {
    if (type.instance !== 'String') return;

    // A field that states its own limit knows better than this default.
    const options = (type as unknown as { options?: Record<string, unknown> }).options ?? {};
    if (options.maxlength !== undefined || options.maxLength !== undefined) return;

    const last = path.split('.').pop() as string;
    const max = LONG_TEXT_PATHS.has(last) ? LONG_TEXT_MAX : DEFAULT_MAX_STRING;

    (type as unknown as { maxlength: (n: number, message: string) => void }).maxlength(
      max,
      'That entry is too long. Please shorten it and try again.'
    );
  });

  // Subdocument arrays compile their own schemas; they need the same floor.
  schema.eachPath((_path, type) => {
    const nested = (type as unknown as { schema?: Schema }).schema;
    if (nested) capStrings(nested);
  });
};

export const registerSchemaGuards = () => {
  mongoose.plugin(capStrings);
};

registerSchemaGuards();
