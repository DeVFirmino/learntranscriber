function normalizeLocale(value) {
  return String(value || '')
    .trim()
    .replaceAll('_', '-')
    .toLowerCase();
}

function normalizeUsage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input)
      .map(([locale, timestamp]) => [normalizeLocale(locale), Number(timestamp)])
      .filter(([locale, timestamp]) => locale && Number.isFinite(timestamp) && timestamp > 0),
  );
}

function replacementLocale(assets, requested, usage) {
  const reserved = Array.isArray(assets?.reservedLocales) ? assets.reservedLocales : [];
  const maximum = Number(assets?.maximumReservedLocales);
  const locale = normalizeLocale(requested);
  if (
    !assets?.assetManagementAvailable ||
    !Number.isFinite(maximum) ||
    maximum <= 0 ||
    reserved.length < maximum ||
    reserved.some((item) => normalizeLocale(item) === locale)
  )
    return null;
  const timestamps = normalizeUsage(usage);
  return (
    reserved
      .filter((item) => typeof item === 'string' && item.trim() && normalizeLocale(item) !== locale)
      .sort(
        (left, right) =>
          (timestamps[normalizeLocale(left)] || 0) - (timestamps[normalizeLocale(right)] || 0) ||
          left.localeCompare(right),
      )[0] || null
  );
}

module.exports = { normalizeLocale, normalizeUsage, replacementLocale };
