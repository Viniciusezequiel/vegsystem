import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExternalReservationData {
  room_id: string;
  title: string;
  description?: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  attendees_count: number;
  start_datetime: string;
  end_datetime: string;
}

interface ExternalReservationResponse {
  success: boolean;
  reservation?: any;
  error?: string;
  details?: string[];
}

export function useCreateExternalReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ExternalReservationData): Promise<ExternalReservationResponse> => {
      const { data: response, error } = await supabase.functions.invoke<ExternalReservationResponse>(
        'create-external-reservation',
        {
          body: data,
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to create reservation');
      }

      if (!response?.success) {
        const errorMessage = response?.details?.join(', ') || response?.error || 'Failed to create reservation';
        throw new Error(errorMessage);
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation-logs'] });
      toast({
        title: 'Reserva criada',
        description: 'Sua solicitação foi enviada com sucesso e está pendente de aprovação.',
      });
    },
    onError: (error: Error) => {
      let message = error.message;
      
      // Translate common error messages
      if (message.includes('Too many requests')) {
        message = 'Muitas solicitações. Aguarde um momento antes de tentar novamente.';
      } else if (message.includes('already a reservation')) {
        message = 'Já existe uma reserva para este horário nesta sala.';
      } else if (message.includes('Room not found')) {
        message = 'Sala não encontrada.';
      }

      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
