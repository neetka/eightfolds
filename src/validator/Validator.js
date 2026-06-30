const { z } = require('zod');

class Validator {
  /**
   * Dynamically build a Zod schema based on the flat structure config specifications.
   * @param {Object} config - Configuration spec object.
   * @returns {z.ZodObject} Constructed Zod schema.
   */
  static buildSchema(config) {
    if (!config || !Array.isArray(config.fields)) {
      throw new Error('Invalid validation config: missing fields specification.');
    }

    const { fields } = config;
    const schemaShape = {};

    for (const field of fields) {
      const fieldKey = field.path;
      const isRequired = field.required === true;

      // Base validation matching canonical type definitions
      let baseSchema;
      switch (fieldKey) {
        case 'emails':
        case 'phones':
        case 'skills':
          baseSchema = z.array(z.string());
          break;
        case 'experience':
          baseSchema = z.array(z.object({
            company: z.string(),
            title: z.string(),
            start: z.string(),
            end: z.string(),
            summary: z.string()
          }));
          break;
        case 'education':
          baseSchema = z.array(z.object({
            institution: z.string(),
            degree: z.string(),
            field: z.string(),
            end_year: z.string()
          }));
          break;
        case 'location':
          baseSchema = z.object({
            city: z.string(),
            region: z.string(),
            country: z.string()
          });
          break;
        case 'links':
          baseSchema = z.object({
            linkedin: z.string().nullable(),
            github: z.string().nullable(),
            portfolio: z.string().nullable(),
            other: z.array(z.string())
          });
          break;
        case 'years_experience':
          baseSchema = z.number().nullable();
          break;
        default:
          // strings for full_name, candidate_id, headline
          baseSchema = z.string().nullable();
          break;
      }

      if (isRequired) {
        // Refine for empty string or empty array if required
        schemaShape[fieldKey] = z.any().refine(
          val => {
            if (val === undefined || val === null || val === '') return false;
            if (Array.isArray(val) && val.length === 0) return false;
            return true;
          },
          { message: `Required field "${fieldKey}" is empty or missing.` }
        );
      } else {
        schemaShape[fieldKey] = z.union([baseSchema, z.null()]).optional();
      }
    }

    return z.object(schemaShape);
  }

  /**
   * Validate projected data payload.
   */
  static validate(projectedData, config) {
    try {
      const schema = this.buildSchema(config);
      const result = schema.safeParse(projectedData);

      if (result.success) {
        return { success: true, data: result.data };
      }

      const formattedErrors = result.error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors: formattedErrors };
    } catch (e) {
      return { success: false, errors: [e.message] };
    }
  }
}

module.exports = Validator;
