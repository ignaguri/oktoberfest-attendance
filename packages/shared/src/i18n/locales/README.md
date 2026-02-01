# Translation Files

## Available Languages

- ✅ **en.json** - English (complete)
- ✅ **de.json** - German / Deutsch (complete)
- 🚧 **es.json** - Spanish / Español (placeholder - currently shows English text)

## Adding Translations

When adding Spanish translations:

1. Use `de.json` as a reference for structure
2. Translate all keys while keeping:
   - Placeholder syntax intact (e.g., `{{count}}`, `{{name}}`)
   - i18next pluralization syntax (e.g., `_other`, `_zero`)
   - HTML tags and formatting
3. Use appropriate cultural context (festivals, measurements, etc.)

## Future Languages

To add more languages:

1. Add language code to `SUPPORTED_LANGUAGES` in `../core.ts`
2. Add display name to `LANGUAGE_NAMES` in `../core.ts`
3. Import the translation file in `../core.ts` resources
4. Create database migration to update `valid_language_code` constraint
5. Create translation JSON file in this directory
