// Only Google Chrome can give an extension a Google token: getAuthToken rides
// on Chrome's own Google sign-in, which Google keeps out of other Chromium
// browsers. There, Connect opens Google's "Access blocked: request is invalid"
// page (seen in Dia and reported for Arc) and in Dia the call never comes
// back. Google Chrome always lists the brand "Google Chrome" in
// navigator.userAgentData.brands, on every channel and platform; Dia leaves it
// out even though its user-agent string still says Chrome (Dia 154 reports
// only "Chromium"). Missing or empty brand data (Chrome 88 and 89, or a
// user-agent override without client-hint metadata) counts as Chrome, so the
// check never blocks anyone on uncertain data. Keep it that way.
function isOtherChromium() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  return Array.isArray(brands) && brands.length > 0 && !brands.some((b) => b.brand === 'Google Chrome');
}
