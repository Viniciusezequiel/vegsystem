import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PsLocationRoom = {
  id: string;
  building_id: string;
  floor: string;
  room: string;
  capacity: number | null;
  active: boolean;
};

export type PsLocationBuilding = {
  id: string;
  location_id: string;
  name: string;
  active: boolean;
  rooms: PsLocationRoom[];
};

export type PsEventLocation = {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  buildings: PsLocationBuilding[];
};

async function loadLocations(locationIds?: string[]): Promise<PsEventLocation[]> {
  let locationQuery = (supabase as any)
    .from('ps_locations')
    .select('id,name,address,active')
    .eq('active', true)
    .order('name');

  if (locationIds) {
    if (!locationIds.length) return [];
    locationQuery = locationQuery.in('id', locationIds);
  }

  const { data: locations, error: locationError } = await locationQuery;
  if (locationError) throw locationError;
  const ids = (locations || []).map((item: any) => item.id);
  if (!ids.length) return [];

  const { data: buildings, error: buildingError } = await (supabase as any)
    .from('ps_location_buildings')
    .select('id,location_id,name,active')
    .in('location_id', ids)
    .eq('active', true)
    .order('name');
  if (buildingError) throw buildingError;

  const buildingIds = (buildings || []).map((item: any) => item.id);
  let rooms: any[] = [];
  if (buildingIds.length) {
    const roomResult = await (supabase as any)
      .from('ps_location_rooms')
      .select('id,building_id,floor,room,capacity,active')
      .in('building_id', buildingIds)
      .eq('active', true)
      .order('floor')
      .order('room');
    if (roomResult.error) throw roomResult.error;
    rooms = roomResult.data || [];
  }

  return (locations || []).map((location: any) => ({
    ...location,
    buildings: (buildings || [])
      .filter((building: any) => building.location_id === location.id)
      .map((building: any) => ({
        ...building,
        rooms: rooms.filter((room: any) => room.building_id === building.id),
      })),
  }));
}

export function usePsEventLocationStructure(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_locations_structure', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ps_event_locations')
        .select('location_id')
        .eq('event_id', eventId!);
      if (error) throw error;
      return loadLocations((data || []).map((item: any) => item.location_id));
    },
  });
}

export function usePsAllLocations() {
  return useQuery({
    queryKey: ['ps_locations_all'],
    queryFn: () => loadLocations(),
  });
}

export function usePsEventLocationActions(eventId?: string) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ps_event_locations_structure', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['ps_locations_all'] }),
      queryClient.invalidateQueries({ queryKey: ['ps_event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['ps_events'] }),
    ]);
  };

  const createAndAttach = useMutation({
    mutationFn: async ({ name, address }: { name: string; address?: string | null }) => {
      if (!eventId) throw new Error('Evento não informado.');
      const { data, error } = await (supabase as any).rpc('ps_admin_create_and_attach_location', {
        p_event_id: eventId,
        p_name: name.trim(),
        p_address: address?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Local cadastrado e vinculado ao evento.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const attach = useMutation({
    mutationFn: async (locationId: string) => {
      if (!eventId) throw new Error('Evento não informado.');
      const { error } = await (supabase as any).rpc('ps_admin_attach_event_location', {
        p_event_id: eventId,
        p_location_id: locationId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Local vinculado ao evento.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importRows = useMutation({
    mutationFn: async (rows: Array<Record<string, unknown>>) => {
      if (!eventId) throw new Error('Evento não informado.');
      const { data, error } = await (supabase as any).rpc('ps_admin_import_event_locations', {
        p_event_id: eventId,
        p_rows: rows,
      });
      if (error) throw error;
      return data as { rows: number; locations: number; buildings: number; rooms: number };
    },
    onSuccess: async (result) => {
      await invalidate();
      toast.success(`${result?.rooms || 0} salas/ambientes importados.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { createAndAttach, attach, importRows };
}
