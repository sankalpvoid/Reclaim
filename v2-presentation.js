// Trusted, static headings only. Navigation, persistence and interactions stay in app.js.
export function sectionHeading(title,art='living-petal'){
  return `<div class="v2-heading"><img src="assets/${art}.webp" alt="" aria-hidden="true"><h1>${title}</h1></div>`;
}
export function toolArtwork(tool){
  return `<img class="v2-tool-art" src="assets/${tool==='walk'?'activity-stretch':tool==='timer'?'ritual-path':'living-petal'}.webp" alt="" aria-hidden="true" loading="lazy">`;
}
