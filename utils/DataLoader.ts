
import { PlanetData, RealStar, Constellation } from '../types';

// --- Helper Interfaces ---
interface ParseResult {
  planets: PlanetData[];
  dwarfs: PlanetData[];
  asteroidsComets: PlanetData[];
  allObjects: PlanetData[]; // Flattened list of everything (including invalid placeholders)
  errors: string[]; // Summary of errors
  realStars: RealStar[];
  constellations: Constellation[];
}

interface RawBlock {
  typeTag: string;
  contentLines: string[];
  fullText: string;
}

// --- Main Loader ---
export const loadSolarSystemData = async (): Promise<ParseResult> => {
  const errors: string[] = [];
  let officialText = '';
  let customText = '';
  let realStars: RealStar[] = [];
  let constellations: Constellation[] = [];

  // 1. Source A: Official File & Stars Data
  try {
    const [solarRes, starsRes, constRes] = await Promise.all([
        fetch('/data/solar_system.txt'),
        fetch('/data/real_stars.json'),
        fetch('/data/constellations.json')
    ]);

    if (solarRes.ok) officialText = await solarRes.text();
    else errors.push("Failed to load standard solar_system.txt");

    if (starsRes.ok) {
        realStars = await starsRes.json();
    } else {
        console.warn("Failed to load real_stars.json");
    }

    if (constRes.ok) {
        constellations = await constRes.json();
    } else {
        console.warn("Failed to load constellations.json");
    }

  } catch (e) {
    errors.push(`Network error loading data: ${e}`);
  }

  // 2. Source B: Custom User Data (LocalStorage)
  try {
    const localData = localStorage.getItem('custom_bodies_text');
    if (localData) {
      customText = localData;
    }
  } catch (e) {
    console.warn("Local storage access failed", e);
  }

  // 3. Parse Separately to Track Origin
  const officialObjects = parseRawTextToObjects(officialText, false);
  const customObjects = parseRawTextToObjects(customText, true);

  // 4. Merge & Link
  const allRawObjects = [...officialObjects.objects, ...customObjects.objects];
  const allErrors = [...errors, ...officialObjects.errors, ...customObjects.errors];

  const linkedResult = linkAndCategorize(allRawObjects, allErrors);
  
  return {
      ...linkedResult,
      realStars,
      constellations
  };
};

// --- Step 1: Text to Objects (Categorization by Source) ---
const parseRawTextToObjects = (text: string, isCustomSource: boolean): { objects: PlanetData[], errors: string[] } => {
    const lines = text.split('\n');
    const blocks: RawBlock[] = [];
    let currentBlock: RawBlock | null = null;
    const parsedObjects: PlanetData[] = [];
    const errors: string[] = [];

    // A. Chunking
    for (const line of lines) {
        const trim = line.trim();
        if (!trim || trim.startsWith('#')) {
            if (currentBlock) currentBlock.fullText += line + '\n';
            continue;
        }

        if (trim.startsWith('[') && trim.endsWith(']')) {
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = {
                typeTag: trim.slice(1, -1),
                contentLines: [],
                fullText: line + '\n'
            };
        } else {
            if (currentBlock) {
                currentBlock.contentLines.push(trim);
                currentBlock.fullText += line + '\n';
            }
        }
    }
    if (currentBlock) blocks.push(currentBlock);

    // B. Parsing
    for (const block of blocks) {
        try {
            const obj = parseSingleBlock(block, isCustomSource);
            parsedObjects.push(obj);
        } catch (e: any) {
            parsedObjects.push({
                id: `error-${Math.random().toString(36).substr(2, 9)}`,
                name: `Parse Error: ${block.typeTag}`,
                englishName: 'Unknown',
                color: '#ff0000',
                radius: 1,
                relativeRadius: 1,
                elements: { a:0, e:0, i:0, N:0, w:0, M:0 },
                visible: false,
                isCustom: isCustomSource,
                isValid: false,
                parseError: e.message || "Unknown parsing error",
                rawContent: block.fullText,
                category: block.typeTag
            });
        }
    }

    return { objects: parsedObjects, errors };
};

const parseSingleBlock = (block: RawBlock, isCustomSource: boolean): PlanetData => {
  const obj: Partial<PlanetData> = {
    visible: true,
    isValid: true,
    isCustom: isCustomSource, // Crucial fix: Use the passed source flag
    category: block.typeTag,
    rawContent: block.fullText,
    type: 'planet' // Default
  };

  // Default types based on Tag
  if (block.typeTag === 'DWARF') obj.type = 'dwarf';
  if (block.typeTag === 'COMET') obj.type = 'comet';
  if (block.typeTag === 'RING') (obj as any).isRing = true;
  if (block.typeTag === 'SATELLITE') obj.type = 'satellite';

  for (const line of block.contentLines) {
    const parts = line.split(':');
    if (parts.length < 2) continue;
    
    const key = parts[0].trim();
    const val = parts.slice(1).join(':').trim();

    if (!val) continue;

    if (key === 'elements') {
      const nums = val.split(/\s+/).map(n => parseFloat(n));
      if (nums.some(isNaN)) throw new Error("Invalid orbital elements (NaN)");
      if (nums.length < 6) throw new Error("Insufficient orbital elements (Need 6)");
      obj.elements = {
        a: nums[0], e: nums[1], i: nums[2], N: nums[3], w: nums[4], M: nums[5]
      };
    } else if (key === 'dimensions') {
        const nums = val.split(/\s+/).map(Number);
        obj.innerRadius = nums[0];
        obj.outerRadius = nums[1];
    } else if (['radius', 'relativeRadius', 'massRelativeToSun', 'opacity', 'tilt'].includes(key)) {
        const num = parseFloat(val);
        if (isNaN(num)) throw new Error(`Invalid number for ${key}`);
        (obj as any)[key] = num;
    } else if (key === 'color') {
        obj.color = val;
    } else if (key === 'id') {
        obj.id = val;
    } else if (key === 'name') {
        obj.name = val;
    } else if (key === 'englishName') {
        obj.englishName = val;
    } else if (key === 'type') {
        (obj as any)[key] = val.toLowerCase();
    } else if (key === 'parent') {
        (obj as any)._parentId = val;
    }
  }

  // Validation
  if (!obj.id) throw new Error("Missing ID");
  if (!obj.elements && !obj.isRing) throw new Error("Missing Elements");
  if (!obj.name) obj.name = obj.id;

  return obj as PlanetData;
};

// --- Step 2: Link and Categorize ---
const linkAndCategorize = (allObjects: PlanetData[], initialErrors: string[]) => {
    const objectMap = new Map<string, PlanetData>();
    allObjects.forEach(obj => {
        if (obj.isValid) objectMap.set(obj.id, obj);
    });

    // Link Satellites / Rings
    allObjects.forEach(obj => {
        const parentId = (obj as any)._parentId;
        if (parentId) {
            const parent = objectMap.get(parentId);
            if (parent) {
                if (!parent.satellites) parent.satellites = [];
                parent.satellites.push(obj);
            } else {
                if (!obj.parseError) obj.parseError = `Parent '${parentId}' not found.`;
            }
        }
    });

    // Distribute
    const planets: PlanetData[] = [];
    const dwarfs: PlanetData[] = [];
    const asteroidsComets: PlanetData[] = [];
    const errors: string[] = [...initialErrors];

    for (const obj of allObjects) {
        if (!obj.isValid) {
            errors.push(`${obj.name}: ${obj.parseError}`);
            continue;
        }

        const parentId = (obj as any)._parentId;
        const isChild = parentId && objectMap.has(parentId);

        if (!isChild) {
            if (obj.category === 'PLANET') planets.push(obj);
            else if (obj.category === 'DWARF') dwarfs.push(obj);
            else if (obj.category === 'COMET' || obj.type === 'comet' || obj.type === 'asteroid') asteroidsComets.push(obj);
            else if (obj.category === 'SATELLITE' || obj.category === 'RING') {
                 asteroidsComets.push(obj);
            }
        }
    }

    return {
        planets,
        dwarfs,
        asteroidsComets,
        allObjects,
        errors
    };
};
