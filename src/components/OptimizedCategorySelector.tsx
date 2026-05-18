import React, { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { getCacheItem, setCacheItem, removeCacheItem } from "@/lib/cache";
import { toast } from "sonner";

export interface Category {
  id: string;
  nome: string;
  descricao?: string;
}

interface OptimizedCategorySelectorProps {
  onSelect: (id: string) => void;
  selectedId?: string;
  placeholder?: string;
  className?: string;
}

const CACHE_KEY = 'api_categories_cache';
const CATEGORIES_TTL = 24; // hours

export const OptimizedCategorySelector: React.FC<OptimizedCategorySelectorProps> = ({
  onSelect,
  selectedId,
  placeholder = "Selecione uma categoria",
  className = ""
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    
    if (!force) {
      const cached = getCacheItem<Category[]>(CACHE_KEY);
      if (cached) {
        setCategories(cached);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Simulation of an API call - Replace with actual endpoint if available
      // const response = await fetch('/api/categories');
      // if (!response.ok) throw new Error('Falha ao carregar categorias');
      // const data = await response.json();
      
      // Simulated response
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockData: Category[] = [
        { id: '1', nome: 'Smartphones', descricao: 'Aparelhos celulares' },
        { id: '2', nome: 'Acessórios', descricao: 'Cabos, carregadores, etc' },
        { id: '3', nome: 'Serviços', descricao: 'Manutenção e garantias' },
        { id: '4', nome: 'Películas', descricao: 'Proteção de tela' },
        { id: '5', nome: 'Cases', descricao: 'Capas de proteção' },
        { id: '6', nome: 'Geral', descricao: 'Outros produtos' },
      ];

      setCategories(mockData);
      setCacheItem(CACHE_KEY, mockData, CATEGORIES_TTL);
      if (force) toast.success("Categorias atualizadas!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      toast.error(`Erro: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleManualRefresh = () => {
    fetchCategories(true);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando categorias...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border border-destructive bg-destructive/10 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Erro ao carregar dados</span>
            </div>
          ) : (
            <Select value={selectedId} onValueChange={onSelect}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleManualRefresh} 
          disabled={isLoading}
          title="Recarregar Categorias"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {error && (
        <Button 
          variant="link" 
          size="sm" 
          className="text-xs text-primary justify-start p-0 h-auto"
          onClick={() => fetchCategories(true)}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
};
