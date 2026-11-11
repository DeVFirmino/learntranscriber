import type { CatalogModel, LocalModel } from '@/bridge/types/local-models'

export interface ModelCatalogRow {
  entry: CatalogModel | LocalModel
  model?: LocalModel
  downloaded: boolean
}

// Catalog names identify a model family; installed files keep their own UUID. Older imports can be associated by
// their verified digest. Noncatalog imports remain visible, and legacy catalog choices appear only when installed.
export function modelCatalogRows(catalog: CatalogModel[], models: LocalModel[], kind: string): ModelCatalogRow[] {
  const available = models.filter((model) => model.kind === kind && model.available)
  const used = new Set<string>()
  const rows: ModelCatalogRow[] = []
  for (const entry of catalog.filter((item) => item.kind === kind)) {
    const model =
      available.find((item) => !used.has(item.id) && item.catalogId === entry.id) ||
      available.find((item) => !used.has(item.id) && item.sha256 === entry.sha256)
    if (model) used.add(model.id)
    if (!entry.legacy || model) rows.push({ entry, model, downloaded: Boolean(model) })
  }
  for (const model of available) if (!used.has(model.id)) rows.push({ entry: model, model, downloaded: true })
  return rows
}
