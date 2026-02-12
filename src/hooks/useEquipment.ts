export function useEquipmentList() { ... }

export function useEquipmentLoans(status?: 'active' | 'returned') { ... }

export function useDeleteEquipment() {
  const deleteEquipment = async (id: string) => {
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) throw error;
  };
  return { deleteEquipment };
}

export function useCreateEquipmentLoan() {
  const createLoan = async (loanData: any) => {
    const { data, error } = await supabase.from('equipment_loans').insert(loanData);
    if (error) throw error;
    return data;
  };
  return { createLoan };
}

// Se algum arquivo usa useEquipment
export function useEquipment(id: string) {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    async function fetchEquipment() {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id)
        .single();
      if (!error) setData(data);
    }
    fetchEquipment();
  }, [id]);

  return { data };
}
