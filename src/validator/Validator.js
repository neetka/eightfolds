const { z } = require('zod');

class Validator {
  /**
   * Dynamically build a Zod schema based on the projection config specifications.
   * @param {Object} config - Configuration spec object.
   * @returns {z.ZodObject} Constructed Zod schema.
   */
  static buildSchema(config) {
    if (!config || !Array.isArray(config.fields)) {
      throw new Error('Invalid validation config: missing fields specification.');
    }

    const { fields, include_confidence = true, include_provenance = true } = config;
    const schemaShape = {};

    for (const field of fields) {
      const fieldKey = field.path;
      const isRequired = field.required === true;

      // Schema for the actual value leaf
      let valueSchema = z.any();
      if (isRequired) {
        valueSchema = z.any().refine(
          val => {
            if (val === undefined || val === null || val === '') return false;
            if (Array.isArray(val) && val.length === 0) return false;
            return true;
          },
          { message: `Required field "${fieldKey}" is empty or missing.` }
        );
      } else {
        valueSchema = z.any().nullable().optional();
      }

      // If output includes metadata wrappers, build object schema
      if (include_confidence || include_provenance) {
        const metadataObjectShape = {
          value: valueSchema
        };

        if (include_confidence) {
          metadataObjectShape.confidence = z.number().min(0).max(1).nullable().optional();
        }

        if (include_provenance) {
          metadataObjectShape.provenance = z.object({
            source: z.string(),
            method: z.string()
          }).nullable().optional();
        }

        // If the field is an array (like skills, experience), it might output a list of wrapped items
        // To handle this, we check if the path contains array keywords, but since it is dynamically mapped
        // we can allow the schema to accept either the metadata object or an array of metadata objects.
        schemaShape[fieldKey] = z.union([
          z.object(metadataObjectShape),
          z.array(z.object(metadataObjectShape))
        ]);
      } else {
        // If metadata is excluded, it's just the raw value directly
        schemaShape[fieldKey] = valueSchema;
      }
    }

    return z.object(schemaShape);
  }

  /**
   * Validates projected JSON against the dynamic Zod schema.
   * @param {Object} projectedJson - Projected JSON output.
   * @param {Object} config - Projection config.
   * @returns {{ success: boolean, data?: any, errors?: Array<string> }} Result status.
   */
  static validate(projectedJson, config) {
    try {
      const schema = this.buildSchema(config);
      const result = schema.safeParse(projectedJson);

      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      }

      // Format and return Zod errors cleanly instead of crashing
      const errors = result.error.errors.map(err => {
        const pathStr = err.path.join('.');
        return `${pathStr ? pathStr + ': ' : ''}${err.message}`;
      });

      return {
        success: false,
        errors
      };
    } catch (err) {
      return {
        success: false,
        errors: [err.message]
      };
    }
  }
}

module.exports = Validator;
