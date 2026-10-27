import { toNestErrors, validateFieldsNatively } from '@hookform/resolvers';
import type { FieldError, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form resolver for zod 4. `@hookform/resolvers` 3.9 only knows
 * zod 3's errors (`error.errors`), so with zod 4 it rethrows a failed
 * validation instead of returning it: the submit does nothing and the
 * ZodError lands in the console. This reads zod 4's `issues` and gives each
 * field its first message.
 */
export function zodResolver<T extends FieldValues>(schema: z.ZodType<T>): Resolver<T> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      if (options.shouldUseNativeValidation) validateFieldsNatively({}, options);
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, FieldError> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.map(String).join('.');
      if (!errors[path]) errors[path] = { message: issue.message, type: issue.code };
    }
    return { values: {}, errors: toNestErrors(errors, options) };
  };
}
