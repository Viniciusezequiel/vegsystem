import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useExternalUserProfile } from '@/hooks/useExternalUsers';
import { toast } from 'sonner';

/**
 * Hook that listens for real-time updates on reservations and equipment requests
 * for the current external user and shows toast notifications.
 */
export function useExternalNotifications() {
  const queryClient = useQueryClient();
  const { data: profile } = useExternalUserProfile();

  const showNotification = useCallback((title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    // Show toast notification
    if (type === 'success') {
      toast.success(title, { description: message, duration: 8000 });
    } else if (type === 'error') {
      toast.error(title, { description: message, duration: 8000 });
    } else if (type === 'warning') {
      toast.warning(title, { description: message, duration: 8000 });
    } else {
      toast.info(title, { description: message, duration: 8000 });
    }

    // Also try to show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: '/favicon.ico' });
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!profile?.email) return;

    const userEmail = profile.email.toLowerCase();

    // Listen for reservation status changes
    const reservationsChannel = supabase
      .channel('external-user-reservation-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Only notify if this is the user's reservation
          if (newData.requester_email?.toLowerCase() !== userEmail) return;

          // Check if status changed
          if (oldData.status !== newData.status) {
            const statusMessages: Record<string, { title: string; type: 'success' | 'info' | 'warning' | 'error' }> = {
              confirmed: { title: 'Reserva Confirmada!', type: 'success' },
              cancelled: { title: 'Reserva Cancelada', type: 'warning' },
              completed: { title: 'Reserva Concluída', type: 'info' },
            };

            const statusInfo = statusMessages[newData.status];
            if (statusInfo) {
              showNotification(
                statusInfo.title,
                `Sua reserva "${newData.title}" foi ${newData.status === 'confirmed' ? 'confirmada' : newData.status === 'cancelled' ? 'cancelada' : 'concluída'}.`,
                statusInfo.type
              );
            }
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['reservations'] });
        }
      )
      .subscribe();

    // Listen for equipment request status changes
    const equipmentChannel = supabase
      .channel('external-user-equipment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'external_equipment_requests',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Only notify if this is the user's request
          if (newData.requester_email?.toLowerCase() !== userEmail) return;

          // Check if status changed
          if (oldData.status !== newData.status) {
            const statusMessages: Record<string, { title: string; message: string; type: 'success' | 'info' | 'warning' | 'error' }> = {
              approved: { 
                title: 'Empréstimo Aprovado!', 
                message: `Seu pedido de "${newData.equipment_name}" foi aprovado.`,
                type: 'success' 
              },
              awaiting_pickup: { 
                title: 'Pronto para Retirada!', 
                message: `O equipamento "${newData.equipment_name}" está pronto para retirada.`,
                type: 'info' 
              },
              rejected: { 
                title: 'Pedido Rejeitado', 
                message: `Seu pedido de "${newData.equipment_name}" foi rejeitado.`,
                type: 'error' 
              },
              loaned: { 
                title: 'Equipamento Emprestado', 
                message: `"${newData.equipment_name}" registrado como emprestado.`,
                type: 'info' 
              },
              returned: { 
                title: 'Devolução Registrada', 
                message: `"${newData.equipment_name}" foi devolvido com sucesso.`,
                type: 'success' 
              },
            };

            const statusInfo = statusMessages[newData.status];
            if (statusInfo) {
              showNotification(statusInfo.title, statusInfo.message, statusInfo.type);
            }
          }

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['external-equipment-requests-by-email'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(equipmentChannel);
    };
  }, [profile?.email, queryClient, showNotification]);
}
