/**
 * Every generated image this bundle serves, and where from. GENERATED — do not edit.
 *
 * Written by `tools/sync-art.mjs` from `public/art/MANIFEST.json`, which came from
 * `micro-aetherholm-assets`. Run `pnpm sync-art` after copying a new asset set in;
 * `test/art.test.ts` fails if this file and the manifest disagree.
 *
 * 75 of the set's 101. The other 26 are the five pieces of browser chrome
 * served from the site root and the 21 this client does not serve at all — read
 * `UNSHIPPED` in the generator for which, and for why each one. They are NOT missing and they
 * were NOT deleted; the art is permanent and lives in `micro-aetherholm-assets`.
 *
 * The manifest's own provenance — the FLUX prompt, the model, the checksum, the C2PA state, the
 * licence and the AI disclosure — is deliberately NOT copied here. It is served whole at
 * `/art/MANIFEST.json`, for all 101, so the disclosure travels with the images.
 *
 * Generator: @cloudsforge/studio via aetherholm-assets/generate.ts
 * Assets in the set: 101
 * Updated: 2026-08-02T12:05:39.067Z
 */

export interface ArtEntry {
  /** `buildings` | `icons` | `islands` | `keyart` | `shipicons` | `ships` | `splashes` | `title`. */
  readonly set: string
  /** The domain key. A building type, an airship class, a resource, a `<band>_<biome>` archetype. */
  readonly slug: string
  readonly name: string
  /** Absolute, browser-resolvable, served by nginx from `/art/`. */
  readonly path: string
  /** `<w>x<h>` as delivered. */
  readonly size: string
  /** The hue the picture was PAINTED around, from the manifest. Art direction, never a UI palette. */
  readonly accent: string | null
}

export const ART: readonly ArtEntry[] = [
  {"set":"buildings","slug":"academy","name":"academy","path":"/art/buildings/academy-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"aerodock","name":"aerodock","path":"/art/buildings/aerodock-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"bulwark_ring","name":"bulwark ring","path":"/art/buildings/bulwark_ring-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"charthouse","name":"charthouse","path":"/art/buildings/charthouse-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"cloudstone_quarry","name":"cloudstone quarry","path":"/art/buildings/cloudstone_quarry-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"guild_beacon","name":"guild beacon","path":"/art/buildings/guild_beacon-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"hall_of_banners","name":"hall of banners","path":"/art/buildings/hall_of_banners-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"infirmary","name":"infirmary","path":"/art/buildings/infirmary-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"launch_rails","name":"launch rails","path":"/art/buildings/launch_rails-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"residences","name":"residences","path":"/art/buildings/residences-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"skyhall","name":"skyhall","path":"/art/buildings/skyhall-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"skysteel_forge","name":"skysteel forge","path":"/art/buildings/skysteel_forge-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"storm_anchor","name":"storm anchor","path":"/art/buildings/storm_anchor-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"terrace_farm","name":"terrace farm","path":"/art/buildings/terrace_farm-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"trade_gantry","name":"trade gantry","path":"/art/buildings/trade_gantry-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"vault","name":"vault","path":"/art/buildings/vault-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"warehouse","name":"warehouse","path":"/art/buildings/warehouse-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"watchspire","name":"watchspire","path":"/art/buildings/watchspire-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"well_rig","name":"well rig","path":"/art/buildings/well_rig-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"buildings","slug":"windworks","name":"windworks","path":"/art/buildings/windworks-512x512.png","size":"512x512","accent":"#c9a06b"},
  {"set":"icons","slug":"resource-aether","name":"Aether","path":"/art/icons/resource-aether-512x512.png","size":"512x512","accent":"#8f7ae8"},
  {"set":"icons","slug":"resource-cloudstone","name":"Cloudstone","path":"/art/icons/resource-cloudstone-512x512.png","size":"512x512","accent":"#c9b891"},
  {"set":"icons","slug":"resource-provisions","name":"Provisions","path":"/art/icons/resource-provisions-512x512.png","size":"512x512","accent":"#8fbf4f"},
  {"set":"icons","slug":"resource-skysteel","name":"Skysteel","path":"/art/icons/resource-skysteel-512x512.png","size":"512x512","accent":"#7fa3c0"},
  {"set":"icons","slug":"status-aegis","name":"Aegis","path":"/art/icons/status-aegis-512x512.png","size":"512x512","accent":"#7fd4e0"},
  {"set":"icons","slug":"status-spire","name":"Aether spire","path":"/art/icons/status-spire-512x512.png","size":"512x512","accent":"#8f7ae8"},
  {"set":"icons","slug":"ui-battle","name":"Battle report","path":"/art/icons/ui-battle-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-chronicle","name":"Chronicle","path":"/art/icons/ui-chronicle-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-fleet","name":"Fleet","path":"/art/icons/ui-fleet-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-lane-junction","name":"Lane junction","path":"/art/icons/ui-lane-junction-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-queue-build","name":"Build queue","path":"/art/icons/ui-queue-build-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-queue-research","name":"Research queue","path":"/art/icons/ui-queue-research-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-queue-shipyard","name":"Shipyard queue","path":"/art/icons/ui-queue-shipyard-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"icons","slug":"ui-wind-lane","name":"Wind lane","path":"/art/icons/ui-wind-lane-512x512.png","size":"512x512","accent":"#6d9a49"},
  {"set":"islands","slug":"highwind_crag","name":"highwind crag","path":"/art/islands/highwind_crag-1024x1024.png","size":"1024x1024","accent":"#c9b891"},
  {"set":"islands","slug":"highwind_grove","name":"highwind grove","path":"/art/islands/highwind_grove-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"islands","slug":"highwind_reef","name":"highwind reef","path":"/art/islands/highwind_reef-1024x1024.png","size":"1024x1024","accent":"#8f7ae8"},
  {"set":"islands","slug":"highwind_terrace","name":"highwind terrace","path":"/art/islands/highwind_terrace-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"islands","slug":"midreach_crag","name":"midreach crag","path":"/art/islands/midreach_crag-1024x1024.png","size":"1024x1024","accent":"#c9b891"},
  {"set":"islands","slug":"midreach_grove","name":"midreach grove","path":"/art/islands/midreach_grove-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"islands","slug":"midreach_reef","name":"midreach reef","path":"/art/islands/midreach_reef-1024x1024.png","size":"1024x1024","accent":"#8f7ae8"},
  {"set":"islands","slug":"midreach_terrace","name":"midreach terrace","path":"/art/islands/midreach_terrace-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"islands","slug":"shallows_crag","name":"shallows crag","path":"/art/islands/shallows_crag-1024x1024.png","size":"1024x1024","accent":"#c9b891"},
  {"set":"islands","slug":"shallows_grove","name":"shallows grove","path":"/art/islands/shallows_grove-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"islands","slug":"shallows_reef","name":"shallows reef","path":"/art/islands/shallows_reef-1024x1024.png","size":"1024x1024","accent":"#8f7ae8"},
  {"set":"islands","slug":"shallows_terrace","name":"shallows terrace","path":"/art/islands/shallows_terrace-1024x1024.png","size":"1024x1024","accent":"#8fbf4f"},
  {"set":"keyart","slug":"hero","name":"Hero","path":"/art/keyart/hero-1920x768.png","size":"1920x768","accent":"#8f7ae8"},
  {"set":"keyart","slug":"wordmark-backdrop","name":"Wordmark backdrop","path":"/art/keyart/wordmark-backdrop-1536x512.png","size":"1536x512","accent":"#8f7ae8"},
  {"set":"shipicons","slug":"breaker","name":"breaker icon","path":"/art/shipicons/breaker-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"corvette","name":"corvette icon","path":"/art/shipicons/corvette-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"cutter","name":"cutter icon","path":"/art/shipicons/cutter-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"flagship","name":"flagship icon","path":"/art/shipicons/flagship-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"frigate","name":"frigate icon","path":"/art/shipicons/frigate-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"grand_hauler","name":"grand hauler icon","path":"/art/shipicons/grand_hauler-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"gunship","name":"gunship icon","path":"/art/shipicons/gunship-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"hauler","name":"hauler icon","path":"/art/shipicons/hauler-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"ironclad","name":"ironclad icon","path":"/art/shipicons/ironclad-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"shipicons","slug":"skiff","name":"skiff icon","path":"/art/shipicons/skiff-256x256.png","size":"256x256","accent":"#6d9a49"},
  {"set":"ships","slug":"breaker","name":"breaker","path":"/art/ships/breaker-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"corvette","name":"corvette","path":"/art/ships/corvette-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"cutter","name":"cutter","path":"/art/ships/cutter-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"flagship","name":"flagship","path":"/art/ships/flagship-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"frigate","name":"frigate","path":"/art/ships/frigate-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"grand_hauler","name":"grand hauler","path":"/art/ships/grand_hauler-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"gunship","name":"gunship","path":"/art/ships/gunship-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"hauler","name":"hauler","path":"/art/ships/hauler-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"ironclad","name":"ironclad","path":"/art/ships/ironclad-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"ships","slug":"skiff","name":"skiff","path":"/art/ships/skiff-1024x512.png","size":"1024x512","accent":"#7fa3c0"},
  {"set":"splashes","slug":"private-skerry","name":"Private skerry","path":"/art/splashes/private-skerry-1536x640.png","size":"1536x640","accent":"#8f7ae8"},
  {"set":"splashes","slug":"season-dawn","name":"Season dawn","path":"/art/splashes/season-dawn-1536x640.png","size":"1536x640","accent":"#8f7ae8"},
  {"set":"splashes","slug":"season-seal","name":"Season seal","path":"/art/splashes/season-seal-1536x640.png","size":"1536x640","accent":"#8f7ae8"},
  {"set":"splashes","slug":"spire-war","name":"Spire war","path":"/art/splashes/spire-war-1536x640.png","size":"1536x640","accent":"#8f7ae8"},
  {"set":"splashes","slug":"trade-flotilla","name":"Trade flotilla","path":"/art/splashes/trade-flotilla-1536x640.png","size":"1536x640","accent":"#8f7ae8"},
  {"set":"title","slug":"mark","name":"Aetherholm","path":"/art/title/mark-1024x1024.png","size":"1024x1024","accent":"#6d9a49"},
  {"set":"title","slug":"wordmark","name":"Aetherholm","path":"/art/title/wordmark-1024x384.png","size":"1024x384","accent":"#6d9a49"},
]
