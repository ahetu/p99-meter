import type { EQClass } from './eqClasses';

// ── P99 Pet Name Pool ──
// From the P99 server source (GetRandPetName). All pet classes — Magician,
// Necromancer, Enchanter, Shaman, Shadow Knight — share this same pool.
// Stored lowercase for case-insensitive matching.
const PET_NAME_LIST = [
  'gabaner','gabann','gabantik','gabarab','gabarer','gabarn','gabartik',
  'gabekab','gabeker','gabekn','gaber','gabn','gabobab','gabobn','gabtik',
  'ganer','gann','gantik','garab','garaner','garann','garantik','gararn',
  'garekn','garer','garn','gartik','gasaner','gasann','gasantik','gasarer',
  'gasartik','gasekn','gaser','gebann','gebantik','gebarer','gebarn','gebartik',
  'gebeker','gebekn','gebn','gekab','geker','gekn','genaner','genann','genantik',
  'genarer','genarn','gener','genn','genobtik','gibaner','gibann','gibantik',
  'gibarn','gibartik','gibekn','giber','gibn','gibobtik','gibtik','gobaber',
  'gobaner','gobann','gobarn','gobartik','gober','gobn','gobober','gobobn',
  'gobobtik','gobtik','gonaner','gonann','gonantik','gonarab','gonarer',
  'gonarn','gonartik','gonekab','gonekn','goner','gonobab','gonobtik','gontik','gotik',
  'jabaner','jabann','jabantik','jabarab','jabarer','jabarn','jabartik',
  'jabekab','jabeker','jabekn','jaber','jabn','jabobtik','jabtik','janab',
  'janer','jann','jantik','jarab','jaranab','jaraner','jararer','jararn',
  'jarartik','jareker','jarekn','jarer','jarn','jarobn','jarobtik','jartik',
  'jasab','jasaner','jasantik','jasarer','jasartik','jasekab','jaseker',
  'jasekn','jaser','jasn','jasobab','jasober','jastik','jebanab','jebann',
  'jebantik','jebarab','jebarar','jebarer','jebarn','jebartik','jebeker',
  'jebekn','jeber','jebobn','jebtik','jekab','jeker','jekn','jenann',
  'jenantik','jenarer','jeneker','jenekn','jentik','jibaner','jibann',
  'jibantik','jibarer','jibarn','jibartik','jibeker','jibn','jibobn',
  'jibtik','jobab','jobaner','jobann','jobantik','jobarn','jobartik',
  'jobekab','jobeker','jober','jobn','jobtik','jonanab','jonaner',
  'jonann','jonantik','jonarer','jonarn','jonartik','jonekab','joneker',
  'jonekn','joner','jonn','jonnarn','jonober','jonobn','jonobtik','jontik',
  'kabanab','kabaner','kabann','kabantik','kabarer','kabarn','kabartik',
  'kabeker','kabekn','kaber','kabn','kabober','kabobn','kabobtik','kabtik',
  'kanab','kaner','kann','kantik','karab','karanab','karaner','karann',
  'karantik','kararer','karartik','kareker','karer','karn','karobab','karobn',
  'kartik','kasaner','kasann','kasarer','kasartik','kaseker','kasekn','kaser',
  'kasn','kasober','kastik','kebann','kebantik','kebarab','kebartik','kebeker',
  'kebekn','kebn','kebobab','kebtik','kekab','keker','kekn','kenab','kenaner',
  'kenantik','kenarer','kenarn','keneker','kener','kenn','kenobn','kenobtik',
  'kentik','kibab','kibaner','kibantik','kibarn','kibartik','kibekab','kibeker',
  'kibekn','kibn','kibobn','kibobtik','kobab','kobanab','kobaner','kobann',
  'kobantik','kobarer','kobarn','kobartik','kobeker','kobekn','kober','kobn',
  'kobober','kobobn','kobtik','konanab','konaner','konann','konantik','konarab',
  'konarer','konarn','konekab','koneker','konekn','koner','konn','konobn',
  'konobtik','kontik','labanab','labaner','labann','labarab','labarer',
  'labarn','labartik','labeker','labekn','laner','lann','larab','larantik',
  'lararer','lararn','larartik','lareker','larer','larn','lartik','lasaner',
  'lasann','lasarer','laseker','laser','lasik','lasn','lastik','lebaner',
  'lebarer','lebartik','lebekn','lebtik','lekab','lekn','lenanab','lenaner',
  'lenann','lenartik','lenekab','leneker','lenekn','lentik','libab','libaner',
  'libann','libantik','libarer','libarn','libartik','libeker','libekn','lobann',
  'lobarab','lobarn','lobartik','lobekn','lobn','lobober','lobobn','lobtik',
  'lonaner','lonann','lonantik','lonarab','lonarer','lonarn','lonartik','lonekn',
  'loner','lonobtik','lontik','vabanab','vabaner','vabann','vabantik','vabarer',
  'vabarn','vabartik','vabeker','vabekn','vabtik','vanikk','vann','varartik','varn',
  'vartik','vasann','vasantik','vasarab','vasarer','vaseker','vebaner','vebantik',
  'vebarab','vebeker','vebekn','vebobn','vekab','veker','venaner','venantik','venar',
  'venarn','vener','ventik','vibann','vibantik','viber','vibobtik','vobann',
  'vobarer','vobartik','vobekn','vober','vobn','vobtik','vonaner','vonann',
  'vonantik','vonarab','vonarn','vonartik','voneker','vonn','xabanab','xabaner',
  'xabarer','xabarn','xabartik','xabekab','xabeker','xabekn','xaber','xabober',
  'xaner','xann','xarab','xaranab','xarann','xarantik','xararer','xarartik','xarer',
  'xarn','xartik','xasaner','xasann','xasarab','xasarn','xasekab','xaseker',
  'xebarer','xebarn','xebeker','xeber','xebober','xebtik','xekab','xeker',
  'xekn','xenann','xenantik','xenarer','xenartik','xenekn','xener','xenober',
  'xentik','xibantik','xibarer','xibekab','xibeker','xibobab','xibober','xibobn',
  'xobaner','xobann','xobarab','xobarn','xobekab','xobeker','xobekn','xober',
  'xobn','xobobn','xobtik','xonaner','xonann','xonantik','xonarer','xonartik',
  'xonekab','xoneker','xonekn','xoner','xonober','xtik','zabaner','zabantik',
  'zabarab','zabekab','zabekn','zaber','zabn','zabobab','zabober','zabtik',
  'zaner','zantik','zarann','zarantik','zararn','zarartik','zareker','zarekn',
  'zarer','zarn','zarober','zartik','zasaner','zasarer','zaseker','zasekn','zasn',
  'zebantik','zebarer','zebarn','zebartik','zebobab','zekab','zekn','zenann',
  'zenantik','zenarer','zenarn','zenekab','zeneker','zenobtik','zibanab','zibaner',
  'zibann','zibarer','zibartik','zibekn','zibn','zibobn','zobaner','zobann',
  'zobarn','zober','zobn','zonanab','zonaner','zonann','zonantik','zonarer',
  'zonartik','zonobn','zonobtik','zontik','ztik',
];

export const PET_NAMES: ReadonlySet<string> = new Set(PET_NAME_LIST);

export function isPetName(name: string): boolean {
  return PET_NAMES.has(name.toLowerCase());
}

// ── Pet Summoning Spells ──
// Maps pet-summoning spell name (lowercase) → class of the summoner.
// These are spells that create a new pet NPC. Utility spells like
// "Summon Companion" (teleports existing pet) are excluded.

const PET_SUMMON_MAP: [string, EQClass][] = [
  // Magician elemental pets
  ['elementalkin: earth', 'Magician'], ['elementalkin: water', 'Magician'],
  ['elementalkin: fire', 'Magician'], ['elementalkin: air', 'Magician'],
  ['elementaling: earth', 'Magician'], ['elementaling: water', 'Magician'],
  ['elementaling: fire', 'Magician'], ['elementaling: air', 'Magician'],
  ['elemental: earth', 'Magician'], ['elemental: water', 'Magician'],
  ['elemental: fire', 'Magician'], ['elemental: air', 'Magician'],
  ['minor summoning: earth', 'Magician'], ['minor summoning: water', 'Magician'],
  ['minor summoning: fire', 'Magician'], ['minor summoning: air', 'Magician'],
  ['lesser summoning: earth', 'Magician'], ['lesser summoning: water', 'Magician'],
  ['lesser summoning: fire', 'Magician'], ['lesser summoning: air', 'Magician'],
  ['summoning: earth', 'Magician'], ['summoning: water', 'Magician'],
  ['summoning: fire', 'Magician'], ['summoning: air', 'Magician'],
  ['greater summoning: earth', 'Magician'], ['greater summoning: water', 'Magician'],
  ['greater summoning: fire', 'Magician'], ['greater summoning: air', 'Magician'],
  ['vocarate: earth', 'Magician'], ['vocarate: water', 'Magician'],
  ['vocarate: fire', 'Magician'], ['vocarate: air', 'Magician'],
  ['conjuration: earth', 'Magician'], ['conjuration: water', 'Magician'],
  ['conjuration: fire', 'Magician'], ['conjuration: air', 'Magician'],
  ['lesser conjuration: earth', 'Magician'], ['lesser conjuration: water', 'Magician'],
  ['lesser conjuration: fire', 'Magician'], ['lesser conjuration: air', 'Magician'],
  ['minor conjuration: earth', 'Magician'], ['minor conjuration: water', 'Magician'],
  ['minor conjuration: fire', 'Magician'], ['minor conjuration: air', 'Magician'],
  ['greater conjuration: earth', 'Magician'], ['greater conjuration: water', 'Magician'],
  ['greater conjuration: fire', 'Magician'], ['greater conjuration: air', 'Magician'],
  ['greater vocaration: earth', 'Magician'], ['greater vocaration: water', 'Magician'],
  ['greater vocaration: fire', 'Magician'], ['greater vocaration: air', 'Magician'],
  ['monster summoning i', 'Magician'], ['monster summoning ii', 'Magician'],
  ['monster summoning iii', 'Magician'], ['monster summoning iv', 'Magician'],

  // Necromancer undead pets
  ['cavorting bones', 'Necromancer'], ['leering corpse', 'Necromancer'],
  ['bone walk', 'Necromancer'], ['convoke shadow', 'Necromancer'],
  ['restless bones', 'Necromancer'], ['animate dead', 'Necromancer'],
  ['haunting corpse', 'Necromancer'], ['summon dead', 'Necromancer'],
  ['invoke shadow', 'Necromancer'], ['malignant dead', 'Necromancer'],
  ['cackling bones', 'Necromancer'], ['invoke death', 'Necromancer'],
  ['minion of shadows', 'Necromancer'], ['servant of bones', 'Necromancer'],
  ['emissary of thule', 'Necromancer'],

  // Enchanter animations
  ["pendril's animation", 'Enchanter'], ["pendril`s animation", 'Enchanter'],
  ["juli's animation", 'Enchanter'], ["juli`s animation", 'Enchanter'],
  ["mircyl's animation", 'Enchanter'], ["mircyl`s animation", 'Enchanter'],
  ["kilan's animation", 'Enchanter'], ["kilan`s animation", 'Enchanter'],
  ["shalee's animation", 'Enchanter'], ["shalee`s animation", 'Enchanter'],
  ["sisna's animation", 'Enchanter'], ["sisna`s animation", 'Enchanter'],
  ["sagar's animation", 'Enchanter'], ["sagar`s animation", 'Enchanter'],
  ["uleen's animation", 'Enchanter'], ["uleen`s animation", 'Enchanter'],
  ["boltran's animation", 'Enchanter'], ["boltran`s animation", 'Enchanter'],
  ["aanya's animation", 'Enchanter'], ["aanya`s animation", 'Enchanter'],
  ["yegoreff's animation", 'Enchanter'], ["yegoreff`s animation", 'Enchanter'],
  ["kintaz's animation", 'Enchanter'], ["kintaz`s animation", 'Enchanter'],
  ["zumaik's animation", 'Enchanter'], ["zumaik`s animation", 'Enchanter'],
  ["aeldorb's animation", 'Enchanter'], ["aeldorb`s animation", 'Enchanter'],
  ["salik's animation", 'Enchanter'], ["salik`s animation", 'Enchanter'],

  // Shaman spirit pets
  ['companion spirit', 'Shaman'], ['frenzied spirit', 'Shaman'],
  ['spirit of the howler', 'Shaman'], ['true spirit', 'Shaman'],

  // Shadow Knight undead pets (shared spells with Necro, but SK-castable)
  // (bone walk, convoke shadow, animate dead, summon dead, malignant dead,
  //  cackling bones are already in the Necro list — detection uses class context)
];

export const PET_SUMMON_SPELLS: ReadonlyMap<string, EQClass> = new Map(PET_SUMMON_MAP);

export const PET_CLASSES: ReadonlySet<EQClass> = new Set<EQClass>([
  'Magician', 'Necromancer', 'Enchanter', 'Shaman', 'Shadow Knight',
]);
