import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'colaborador' | 'supervisao';

interface CreateUserParams {
  email: string;
  password: string;
  role: AppRole;
  colaborador_id?: string;
}

export const useUserManagement = () => {
  const createUser = async ({ email, password, role, colaborador_id }: CreateUserParams) => {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'create',
        email,
        password,
        role,
        colaborador_id
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const deleteUser = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'delete',
        user_id: userId
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const updatePassword = async (userId: string, password: string) => {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'update-password',
        user_id: userId,
        password
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const updateEmail = async (userId: string, email: string) => {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'update-email',
        user_id: userId,
        email
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const updateRole = async (userId: string, role: AppRole) => {
    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'update-role',
        user_id: userId,
        role
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  return {
    createUser,
    deleteUser,
    updatePassword,
    updateEmail,
    updateRole
  };
};
