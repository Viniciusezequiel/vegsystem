// src/hooks/useEquipment.ts
import { useState, useEffect } from 'react';
import { supabase } from '../supabase/client';

// --------------------
// LISTAGEM DE EQUIPAMENTOS
// --------------------
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

// --------------------
// EMPRÉSTIMOS DE EQUIPAMENTOS
// --------------------
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
        .select('*, equipment(*)')
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

// --------------------
// CRIAR EMPRÉSTIMO DE EQUIPAMENTO
// --------------------
export function useCreateEquipmentLoan() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLoan(payload: any) {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('equipment_loans')
      .insert([payload]);

    if (error) setError(error.message);
    setLoading(false);
    return { data, error };
  }

  return { createLoan, loading, error };
}

// --------------------
// CRIAR EQUIPAMENTO
// --------------------
export function useCreateEquipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createEquipment(payload: any) {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('equipment')
      .insert([payload]);

    if (error) setError(error.message);
    setLoading(false);
    return { data, error };
  }

  return { createEquipment, loading, error };
}

// --------------------
// ATUALIZAR EQUIPAMENTO
// --------------------
export function useUpdateEquipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateEquipment(id: string, payload: any) {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('equipment')
      .update(payload)
      .eq('id', id);

    if (error) setError(error.message);
    setLoading(false);
    return { data, error };
  }

  return { updateEquipment, loading, error };
}

// --------------------
// DELETAR EQUIPAMENTO
// --------------------
export function useDeleteEquipment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteEquipment(id: string) {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) setError(error.message);
    setLoading(false);
    return { data, error };
  }

  return { deleteEquipment, loading, error };
}

// --------------------
// TIPO EQUIPMENT
// --------------------
export type Equipment = {
  id: string;
  name: string;
  patrimony_code: string;
  campus: string;
  location: string;
  quantity: number;
  available_quantity: number;
  status: 'available' | 'borrowed' | 'maintenance';
};
