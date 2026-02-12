import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client'; // ajuste o caminho se necessário

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
        // ajuste o relacionamento conforme seu Supabase:
        // se a foreign key é `equipment_id` e o relacionamento se chama `equipment`
        .select('*, equipment:equipment_id(*)')
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
