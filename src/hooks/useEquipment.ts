import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

// ---------------------------
// Lista de equipamentos
// ---------------------------
export function useEquipmentList() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) setError(error.message);
      else setData(data || []);

      setLoading(false);
    }

    fetchData();
  }, []);

  return { data, loading, error };
}

// ---------------------------
// Empréstimos de equipamentos
// ---------------------------
export function useEquipmentLoans(status?: 'active' | 'returned') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLoans() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('equipment_loans')
        .select('*, equipment:equipment_id(*)') // ajuste conforme relacionamento
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) setError(error.message);
      else setData(data || []);

      setLoading(false);
    }

    fetchLoans();
  }, [status]);

  return { data, loading, error };
}

// ---------------------------
// Deletar equipamento
// ---------------------------
export function useDeleteEquipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteEquipment = async (id: string) => {
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) setError(error.message);

    setLoading(false);

    return !error;
  };

  return { deleteEquipment, loading, error };
}
