import type { VendaItem, CategoriaId } from './types';

export const CATEGORIAS: { id: CategoriaId; label: string }[] = [
  { id: 'geral', label: 'Todas as Categorias' },
  { id: 'aparelhos', label: 'Geral (Aparelhos)' },
  { id: 'servico', label: 'Serviços' },
  { id: 'bonificado_lc', label: 'Bonificado LC' },
  { id: 'super_bonificado', label: 'Super Bonificado' },
  { id: 'cases', label: 'Cases / Capas' },
  { id: 'peliculas', label: 'Películas' },
  { id: 'anatel', label: 'Anatel' },
  { id: 'acessorios', label: 'Acessórios' },
];

// Classificação única de um item de venda numa categoria — fonte da verdade
// usada tanto no filtro quanto no resumo (antes estava duplicada).
export function matchCategoria(item: VendaItem, categoria: CategoriaId): boolean {
  const grupo = (item.Grupo || '').toUpperCase();
  const subtipo = (item.Subtipo || '').toUpperCase();
  const produto = (item.Produto || '').toUpperCase();

  switch (categoria) {
    case 'aparelhos':
      return (
        grupo.includes('CELULAR') || grupo.includes('IPHONE') || grupo.includes('IPAD') ||
        grupo.includes('WATCH') || grupo.includes('MACBOOK') || subtipo.includes('APARELHO')
      ) && !grupo.includes('SERVIÇO');
    case 'servico':
      return grupo.includes('SERVIÇO') || grupo.includes('GARANTIA') || grupo.includes('PROTEÇÃO');
    case 'bonificado_lc':
      return subtipo.includes('BONIFICADO LC') || produto.includes('BONIFICADO LC');
    case 'super_bonificado':
      return subtipo.includes('SUPER BONIFICADO') || produto.includes('SUPER BONIFICADO');
    case 'cases':
      return grupo.includes('CASE') || grupo.includes('CAPA');
    case 'peliculas':
      return grupo.includes('PELICULA') || produto.includes('PELICULA');
    case 'anatel':
      return subtipo.includes('ANATEL') || produto.includes('ANATEL');
    case 'acessorios':
      return (
        grupo.includes('ACESSORIO') || grupo.includes('CABO') ||
        grupo.includes('CARREGADOR') || grupo.includes('FONE')
      ) && !grupo.includes('CASE') && !grupo.includes('PELICULA');
    default:
      return false;
  }
}
