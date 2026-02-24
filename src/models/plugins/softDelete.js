/**
 * Soft-delete plugin: adds deleted + deletedAt and excludes soft-deleted docs from find/findOne.
 */
export function softDelete(schema) {
  schema.add({
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  });

  schema.pre(/^find/, function () {
    this.where({ deleted: { $ne: true } });
  });
}
