import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'colaborador' | 'supervisao';
type CargoTipo = 'Gerente' | 'Vendedor' | 'VR' | 'Trainee';

export interface ColaboradorLoja {
  colaboradorId: string;
  lojaId: string;
  cargo: CargoTipo;
}

interface UserRoleData {
  role: AppRole;
  colaborador_id: string | null;
  colaborador_loja_id: string | null;
  colaborador_cargo: CargoTipo | null;
  colaborador_acesso_gerente: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [colaboradorLojaId, setColaboradorLojaId] = useState<string | null>(null);
  const [colaboradorCargo, setColaboradorCargo] = useState<CargoTipo | null>(null);
  const [acessoGerente, setAcessoGerente] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [lojasDisponiveis, setLojasDisponiveis] = useState<ColaboradorLoja[]>([]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setColaboradorId(null);
          setColaboradorLojaId(null);
          setColaboradorCargo(null);
          setAcessoGerente(false);
          setLojasDisponiveis([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      // Fetch user role with colaborador info including loja_id, cargo and acesso_gerente
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role,
          colaborador_id,
          colaboradores (
            nome,
            loja_id,
            cargo,
            acesso_gerente
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching role:', error);
        setRole(null);
        setColaboradorId(null);
        setColaboradorLojaId(null);
        setColaboradorCargo(null);
        setAcessoGerente(false);
        setLojasDisponiveis([]);
      } else {
        setRole(data?.role as AppRole);
        setColaboradorId(data?.colaborador_id || null);
        const colaborador = data?.colaboradores as { nome: string; loja_id: string; cargo: CargoTipo; acesso_gerente: boolean } | null;
        setColaboradorLojaId(colaborador?.loja_id || null);
        setColaboradorCargo(colaborador?.cargo || null);
        setAcessoGerente(colaborador?.acesso_gerente || false);

        // Check for multi-store access (via colaborador_lojas table)
        if (data?.colaborador_id && (data?.role === 'colaborador')) {
          const { data: lojasData } = await supabase
            .from('colaborador_lojas')
            .select('loja_id, cargo')
            .eq('colaborador_id', data.colaborador_id);

          if (lojasData && lojasData.length > 0) {
            const lojas = lojasData
              .filter(l => l.loja_id)
              .map(l => ({
                colaboradorId: data.colaborador_id!,
                lojaId: l.loja_id,
                cargo: l.cargo as CargoTipo
              }));
            setLojasDisponiveis(lojas);
          } else {
            setLojasDisponiveis([]);
          }
        } else {
          setLojasDisponiveis([]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setRole(null);
      setColaboradorId(null);
      setColaboradorLojaId(null);
      setColaboradorCargo(null);
      setAcessoGerente(false);
      setLojasDisponiveis([]);
    } finally {
      setLoading(false);
    }
  };

  const switchLoja = (lojaId: string) => {
    const found = lojasDisponiveis.find(l => l.lojaId === lojaId);
    if (found) {
      setColaboradorLojaId(found.lojaId);
      setColaboradorCargo(found.cargo);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setColaboradorId(null);
    setColaboradorLojaId(null);
    setColaboradorCargo(null);
    setAcessoGerente(false);
    setLojasDisponiveis([]);
  };

  return {
    user,
    session,
    role,
    colaboradorId,
    colaboradorLojaId,
    colaboradorCargo,
    acessoGerente,
    loading,
    lojasDisponiveis,
    switchLoja,
    isAdmin: role === 'admin',
    isSupervisao: role === 'supervisao',
    isColaborador: role === 'colaborador',
    isGerente: role === 'colaborador' && (colaboradorCargo === 'Gerente' || acessoGerente),
    signOut
  };
};