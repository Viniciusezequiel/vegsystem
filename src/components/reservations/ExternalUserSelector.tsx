import { useState, useEffect } from 'react';
import { useSearchExternalUsers, useCreateExternalUserAdmin, ExternalUser } from '@/hooks/useExternalUsers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, UserPlus, CreditCard, Mail, Phone, User, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// CPF mask function
const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

interface ExternalUserSelectorProps {
  onSelect: (user: ExternalUser | { full_name: string; email: string; cpf: string; phone?: string }) => void;
  selectedUser?: ExternalUser | null;
  className?: string;
}

export function ExternalUserSelector({ onSelect, selectedUser, className }: ExternalUserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newUserData, setNewUserData] = useState({
    full_name: '',
    email: '',
    cpf: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: searchResults, isLoading } = useSearchExternalUsers(searchTerm);
  const createUser = useCreateExternalUserAdmin();

  const handleSelect = (user: ExternalUser) => {
    onSelect(user);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setErrors({});

    if (!newUserData.full_name || newUserData.full_name.length < 3) {
      setErrors(prev => ({ ...prev, full_name: 'Nome obrigatório (mín. 3 caracteres)' }));
      return;
    }
    if (!newUserData.email || !newUserData.email.includes('@')) {
      setErrors(prev => ({ ...prev, email: 'Email inválido' }));
      return;
    }
    if (!newUserData.cpf || newUserData.cpf.replace(/\D/g, '').length !== 11) {
      setErrors(prev => ({ ...prev, cpf: 'CPF inválido' }));
      return;
    }

    createUser.mutate(newUserData, {
      onSuccess: (user) => {
        onSelect(user);
        setCreateOpen(false);
        setNewUserData({ full_name: '', email: '', cpf: '', phone: '' });
      },
    });
  };

  const handleUseWithoutSaving = () => {
    if (!newUserData.full_name || !newUserData.email || !newUserData.cpf) {
      return;
    }
    onSelect({
      full_name: newUserData.full_name,
      email: newUserData.email,
      cpf: newUserData.cpf.replace(/\D/g, ''),
      phone: newUserData.phone || undefined,
    });
    setCreateOpen(false);
    setNewUserData({ full_name: '', email: '', cpf: '', phone: '' });
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label>Usuário Externo</Label>
      
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-start text-left font-normal"
            >
              {selectedUser ? (
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  {selectedUser.full_name} ({selectedUser.email})
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Buscar por CPF ou email...
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Digite CPF, nome ou email..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults && searchResults.length > 0 ? (
                  <CommandGroup heading="Usuários encontrados">
                    {searchResults.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={user.id}
                        onSelect={() => handleSelect(user)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{user.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.email} • CPF: {formatCPF(user.cpf)}
                          </span>
                        </div>
                        {selectedUser?.id === user.id && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : searchTerm.length >= 3 ? (
                  <CommandEmpty>
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-2">Nenhum usuário encontrado</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          setCreateOpen(true);
                        }}
                        className="gap-1"
                      >
                        <UserPlus className="w-4 h-4" />
                        Criar novo usuário
                      </Button>
                    </div>
                  </CommandEmpty>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    Digite pelo menos 3 caracteres para buscar
                  </div>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setCreateOpen(true)}
          title="Criar novo usuário"
        >
          <UserPlus className="w-4 h-4" />
        </Button>
      </div>

      {/* Create New User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar Usuário Externo</DialogTitle>
            <DialogDescription>
              Preencha os dados do solicitante externo. O CPF é obrigatório.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome Completo *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newUserData.full_name}
                  onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                  placeholder="Nome completo"
                  className={cn("pl-10", errors.full_name && "border-destructive")}
                />
              </div>
              {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
            </div>

            <div>
              <Label>CPF *</Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newUserData.cpf}
                  onChange={(e) => setNewUserData({ ...newUserData, cpf: formatCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  className={cn("pl-10", errors.cpf && "border-destructive")}
                  maxLength={14}
                />
              </div>
              {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf}</p>}
            </div>

            <div>
              <Label>Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className={cn("pl-10", errors.email && "border-destructive")}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
            </div>

            <div>
              <Label>Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newUserData.phone}
                  onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleUseWithoutSaving}>
              Usar sem salvar
            </Button>
            <Button onClick={handleCreateNew} disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cadastrar e usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
