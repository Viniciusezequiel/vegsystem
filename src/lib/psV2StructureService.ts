import { supabase } from '@/integrations/supabase/client';
import type { PsV2StructureImportRow } from '@/lib/psV2Import';

const db = supabase as any;
const check = (error: any) => { if (error) throw error; };

export async function importPsV2Structure(rows: PsV2StructureImportRow[], source: 'import' | 'legacy' = 'import') {
  const locationCache = new Map<string, string>();
  const buildingCache = new Map<string, string>();
  const floorCache = new Map<string, string>();
  const areaCache = new Map<string, string>();
  const counts = { locations: 0, buildings: 0, floors: 0, areas: 0, environments: 0 };

  for (const row of rows) {
    const locationKey = row.location.toLowerCase();
    let locationId = locationCache.get(locationKey);
    if (!locationId) {
      const found = await db.from('ps_v2_locations').select('id').eq('name', row.location).maybeSingle();
      check(found.error);
      if (found.data?.id) locationId = found.data.id;
      else {
        const created = await db.from('ps_v2_locations').insert({
          name: row.location,
          address_line: row.addressLine || null,
          neighborhood: row.neighborhood || null,
          city: row.city || null,
          state: row.state || null,
          postal_code: row.postalCode || null,
          source,
        }).select('id').single();
        check(created.error); locationId = created.data.id; counts.locations += 1;
      }
      locationCache.set(locationKey, locationId!);
    }

    const buildingKey = `${locationId}|${row.building.toLowerCase()}`;
    let buildingId = buildingCache.get(buildingKey);
    if (!buildingId) {
      const found = await db.from('ps_v2_buildings').select('id').eq('location_id', locationId).eq('name', row.building).maybeSingle();
      check(found.error);
      if (found.data?.id) buildingId = found.data.id;
      else {
        const created = await db.from('ps_v2_buildings').insert({ location_id: locationId, name: row.building }).select('id').single();
        check(created.error); buildingId = created.data.id; counts.buildings += 1;
      }
      buildingCache.set(buildingKey, buildingId!);
    }

    const floorKey = `${buildingId}|${row.floor.toLowerCase()}`;
    let floorId = floorCache.get(floorKey);
    if (!floorId) {
      const found = await db.from('ps_v2_floors').select('id').eq('building_id', buildingId).eq('name', row.floor).maybeSingle();
      check(found.error);
      if (found.data?.id) floorId = found.data.id;
      else {
        const created = await db.from('ps_v2_floors').insert({ building_id: buildingId, name: row.floor }).select('id').single();
        check(created.error); floorId = created.data.id; counts.floors += 1;
      }
      floorCache.set(floorKey, floorId!);
    }

    let areaId: string | null = null;
    if (row.area) {
      const areaKey = `${floorId}|${row.area.toLowerCase()}`;
      areaId = areaCache.get(areaKey) || null;
      if (!areaId) {
        const found = await db.from('ps_v2_areas').select('id').eq('floor_id', floorId).eq('name', row.area).maybeSingle();
        check(found.error);
        if (found.data?.id) areaId = found.data.id;
        else {
          const created = await db.from('ps_v2_areas').insert({ floor_id: floorId, name: row.area, area_type: row.areaType || 'other' }).select('id').single();
          check(created.error); areaId = created.data.id; counts.areas += 1;
        }
        areaCache.set(areaKey, areaId!);
      }
    }

    if (row.environment) {
      const found = await db.from('ps_v2_environments').select('id').eq('floor_id', floorId).eq('name', row.environment).maybeSingle();
      check(found.error);
      if (!found.data?.id) {
        const created = await db.from('ps_v2_environments').insert({
          floor_id: floorId,
          area_id: areaId,
          name: row.environment,
          environment_type: row.environmentType || 'classroom',
          capacity: row.capacity ?? null,
        });
        check(created.error); counts.environments += 1;
      }
    }
  }
  return counts;
}

export function legacyCampusToV2Rows(campus: any, floors: any[]): PsV2StructureImportRow[] {
  const rows: PsV2StructureImportRow[] = [];
  for (const floor of floors) {
    const rooms = Array.isArray(floor.rooms) ? floor.rooms : [];
    if (!rooms.length) rows.push({ location: campus.name, building: 'Prédio principal', floor: floor.name, environment: null });
    for (const room of rooms) rows.push({ location: campus.name, building: 'Prédio principal', floor: floor.name, environment: String(room), environmentType: 'classroom' });
  }
  return rows;
}
