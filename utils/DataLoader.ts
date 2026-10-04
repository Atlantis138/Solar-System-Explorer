
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
  let overrideText = '';
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
    overrideText = localStorage.getItem('body_overrides_text') || '';
  } catch (e) {
    console.warn("Local storage access failed", e);
  }

  // 3. Parse Separately to Track Origin
  const linkedResult = mergeCatalogSources(officialText, customText, overrideText, errors);
  
  return {
      ...linkedResult,
      realStars,
      constellations
  };
};

// Built-in edits live separately, so restoring an entry never requires a network write.
export const mergeCatalogSources = (officialText: string, customText = '', overrideText = '', initialErrors: string[] = []) => {
  const official = parseRawTextToObjects(officialText, false);
  const custom = parseRawTextToObjects(customText, true);
  const overrides = parseRawTextToObjects(overrideText, false);
  const errors = [...initialErrors];
  const edited = new Map<string, PlanetData>();
  for (const override of overrides.objects) {
    const original = official.objects.find(body => body.id === override.id && body.isValid);
    if (original?.id === 'arrokoth' && ['阿罗科斯','阿罗斯科'].includes(override.name)) {
      override.name = original.name;
      override.rawContent = override.rawContent?.replace(/^name:\s*(阿罗科斯|阿罗斯科)\s*$/m, `name: ${original.name}`);
    }
    // Vesta was historically misclassified as a dwarf. Retain existing local
    // edits while migrating only that built-in category, never orbital values.
    if (original?.id === 'vesta' && original.category === 'ASTEROID' && override.category === 'DWARF') {
      override.category = 'ASTEROID';
      override.type = 'asteroid';
      override.rawContent = override.rawContent?.replace(/^\s*\[DWARF\]\s*$/m, '[ASTEROID]').replace(/^type:\s*dwarf\s*$/m, 'type: asteroid');
    }
    if (!override.isValid || !original || edited.has(override.id) || override.category !== original.category || override.parentId !== original.parentId) {
      errors.push(`本地修改未应用：${override.id}。${override.parseError || '请保留原天体 ID、分类与母体，且每个 ID 只修改一次。'}`);
      continue;
    }
    override.isOverridden = true;
    override.originalRawContent = original.rawContent;
    override.hasCustomOrbit = JSON.stringify(override.elements) !== JSON.stringify(original.elements) || override.orbitReference !== original.orbitReference || override.ephemerisReference !== original.ephemerisReference;
    override.hasCustomDynamics = override.massRelativeToSun !== original.massRelativeToSun;
    edited.set(override.id, override);
  }
  return linkAndCategorize([...official.objects.map(body => edited.get(body.id) ?? body), ...custom.objects], errors);
};

/** Replace one full text block, preserving all other entries and comments. */
export const replaceCatalogBlock = (text: string, id: string, replacement = ''): string => {
  const blocks = text.split(/(?=^\s*\[[^\]\n]+\]\s*$)/m);
  const remaining = blocks.filter(block => block.match(/^\s*id\s*:\s*(\S+)\s*$/m)?.[1] !== id);
  if (replacement.trim()) remaining.push(replacement.trim());
  return remaining.map(block => block.trim()).filter(Boolean).join('\n\n');
};

export const validateCatalogEdit = (text: string, bodies: PlanetData[], editingId?: string) => {
  const parsed = parseRawTextToObjects(text, true);
  const errors: string[] = [];
  if (!parsed.objects.length) errors.push('请输入至少一个完整的天体数据块。');
  const target = editingId ? bodies.find(body => body.id === editingId) : undefined;
  if (editingId && (parsed.objects.length !== 1 || (target?.isValid && parsed.objects[0].id !== editingId))) errors.push('编辑时请保留原 ID，每次只编辑一个天体；新天体请使用“添加天体”。');
  if (target && !target.isCustom && parsed.objects[0] && (parsed.objects[0].category !== target.category || parsed.objects[0].parentId !== target.parentId)) errors.push('内置天体的分类和母体不能更改；请另建自定义天体。');
  const existing = bodies.filter(body => body.isValid && body.id !== editingId).map(body => ({...body, elements: {...body.elements}, satellites: undefined, dataWarnings: undefined}));
  const candidate = linkAndCategorize([...existing, ...parsed.objects], []);
  errors.push(...candidate.errors);
  const warnings = candidate.allObjects.flatMap(body => (body.dataWarnings ?? []).map(message => `${body.name}：${message}`));
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
};

// --- Step 1: Text to Objects (Categorization by Source) ---
export const parseRawTextToObjects = (text: string, isCustomSource: boolean): { objects: PlanetData[], errors: string[] } => {
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
  if (block.typeTag === 'ASTEROID') obj.type = 'asteroid';
  if (block.typeTag === 'RING') (obj as any).isRing = true;
  if (block.typeTag === 'SATELLITE') obj.type = 'satellite';

  const timing: { epochJD?: number; periodDays?: number; perihelionTimeJD?: number } = {};
  for (const line of block.contentLines) {
    const parts = line.split(':');
    if (parts.length < 2) continue;
    
    const key = parts[0].trim();
    const val = parts.slice(1).join(':').trim();

    if (!val) continue;

    if (key === 'elements') {
      const nums = val.split(/\s+/).map(Number);
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
        const num = Number(val);
        if (!Number.isFinite(num)) throw new Error(`Invalid number for ${key}`);
        (obj as any)[key] = num;
    } else if (key === 'orbitReference' || key === 'ephemerisReference') {
        const allowed = key === 'orbitReference' ? ['body', 'system-barycenter', 'parent'] : ['body', 'system-barycenter'];
        if (!allowed.includes(val)) throw new Error(`Invalid ${key}: ${val}`);
        (obj as any)[key] = val;
    } else if (key === 'epochJD' || key === 'periodDays' || key === 'perihelionTimeJD') {
        const number = Number(val);
        if (!Number.isFinite(number) || number <= 0) throw new Error(`Invalid ${key}`);
        timing[key] = number;
    } else if (key === 'interstellar') {
        if (!['true', 'false'].includes(val)) throw new Error('interstellar 必须为 true 或 false');
        obj.interstellar = val === 'true';
    } else if (key === 'color') {
        obj.color = val;
    } else if (key === 'id') {
        obj.id = val;
    } else if (key === 'name') {
        obj.name = val;
    } else if (key === 'englishName') {
        obj.englishName = val;
    } else if (key === 'description' || key === 'dataSource') {
        obj[key] = val;
    } else if (key === 'type') {
        (obj as any)[key] = val.toLowerCase();
    } else if (key === 'parent') {
        obj.parentId = val;
    }
  }

  // Validation
  if (!obj.id) throw new Error("Missing ID");
  if (!/^[a-zA-Z0-9_-]+$/.test(obj.id)) throw new Error('ID 只能包含字母、数字、短横线和下划线');
  if (!obj.elements && !obj.isRing) throw new Error("Missing Elements");
  if (!obj.name) obj.name = obj.id;
  obj.englishName ??= obj.name;
  obj.color ??= '#aaaaaa';
  obj.radius ??= 2;
  obj.relativeRadius ??= 0.1;
  if (obj.radius <= 0 || obj.relativeRadius <= 0) throw new Error('radius 和 relativeRadius 必须大于 0');
  if (obj.isRing && (!Number.isFinite(obj.innerRadius) || !Number.isFinite(obj.outerRadius) || obj.innerRadius! <= 0 || obj.outerRadius! <= obj.innerRadius!)) throw new Error('环的 dimensions 必须为两个递增的正数（AU）');
  if ((obj.type === 'satellite' || obj.isRing) && !obj.parentId) throw new Error('卫星或环必须填写 parent（母体 ID）');
  if (obj.massRelativeToSun !== undefined && (!Number.isFinite(obj.massRelativeToSun) || obj.massRelativeToSun < 0)) throw new Error('Mass must be finite and non-negative');
  if (obj.elements) {
    Object.assign(obj.elements, timing);
    const { a, e, periodDays, perihelionTimeJD, M } = obj.elements;
    if (!Object.values(obj.elements).every(Number.isFinite) || (obj.id !== 'sun' &&
      !((a > 0 && e >= 0 && e < 1) || (a < 0 && e > 1))))
      throw new Error('椭圆需 a > 0 且 0 ≤ e < 1；双曲线需 a < 0 且 e > 1。暂不支持 e = 1 的抛物线。');
    if (e > 1 && obj.parentId) throw new Error('开放轨道目前仅支持绕太阳的小天体，不能作为卫星轨道。');
    if (e > 1 && periodDays !== undefined) throw new Error('双曲线没有公转周期，请移除 periodDays。');
    if (perihelionTimeJD !== undefined && M !== 0) throw new Error('指定 perihelionTimeJD 时请将 M 设为 0，避免两套时间参数冲突。');
    if (obj.interstellar && (!(e > 1) || !['comet','asteroid'].includes(obj.type ?? '')))
      throw new Error('星际标记仅适用于双曲线上的彗星或小行星。');

  }
  if (obj.orbitReference === 'parent' && !obj.parentId) throw new Error('Parent-relative orbit requires parent');
  if (obj.parentId && obj.orbitReference && obj.orbitReference !== 'parent') throw new Error('Satellite elements must describe the orbit relative to its parent');

  return obj as PlanetData;
};

// --- Step 2: Link and Categorize ---
export const linkAndCategorize = (allObjects: PlanetData[], initialErrors: string[]) => {
    const objectMap = new Map<string, PlanetData>();
    allObjects.forEach(obj => {
        obj.satellites = undefined;
        obj.dataWarnings = [];
        if (!obj.isValid) return;
        if (objectMap.has(obj.id)) {
            obj.isValid = false;
            obj.parseError = `Duplicate ID '${obj.id}'. IDs must be unique.`;
        } else objectMap.set(obj.id, obj);
    });

    // Link Satellites / Rings
    allObjects.forEach(obj => {
        if (!obj.isValid) return;
        const parentId = obj.parentId;
        if (parentId) {
            const parent = objectMap.get(parentId);
            if (parent && parent.isValid && !parent.parentId && !parent.isRing && parent !== obj) {
                if (!obj.isRing && !(parent.massRelativeToSun! > 0) && !obj.elements.periodDays) {
                    obj.isValid = false;
                    obj.parseError = `母体 ${parent.name} 缺少质量，无法计算公转周期。请先编辑母体的 massRelativeToSun，或填写卫星 periodDays。`;
                    return;
                }
                if (!parent.satellites) parent.satellites = [];
                parent.satellites.push(obj);
                if (!obj.isRing) {
                    if (!(parent.massRelativeToSun! > 0)) obj.dataWarnings!.push(`母体 ${parent.name} 缺少质量：已按 periodDays 绕母体运行，暂不计算母体的质心位移。要显示相互绕转，请补充母体与卫星质量。`);
                    if (!(obj.massRelativeToSun! > 0)) obj.dataWarnings!.push('未提供正质量：作为示踪卫星运行，不改变母体的质心位置。填写 massRelativeToSun 可启用相互绕转。');
                    if (obj.elements.periodDays && parent.massRelativeToSun! > 0) {
                        const totalMass=parent.massRelativeToSun! + (obj.massRelativeToSun ?? 0);
                        const derivedPeriod=360/.9856076686 * Math.pow(obj.elements.a,1.5)/Math.sqrt(totalMass);
                        if (Math.abs(obj.elements.periodDays/derivedPeriod-1) > .02)
                            obj.dataWarnings!.push(`填写周期 ${obj.elements.periodDays} 天与轨道半长轴、质量推算的 ${derivedPeriod.toPrecision(5)} 天不一致。运动以 periodDays 为准，质量仍用于分配质心；请核对参数来源。`);
                    }
                    if (obj.isCustom || obj.hasCustomOrbit || obj.hasCustomDynamics) parent.hasCustomDynamics = true;
                    parent.orbitReference ??= 'system-barycenter';
                }
            } else {
                obj.isValid = false;
                obj.parseError = `Parent '${parentId}' must be a valid root body (nested satellite systems are not supported).`;
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

        const parentId = obj.parentId;
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
