import { MarketplaceRules } from '../types';
import amazonLogo from '../../assets/amazon-icon.svg';
import mercadoLivreLogo from '../../assets/meli.png';
import shopeeLogo from '../../assets/shopee.png';
import magazineLuizaLogo from '../../assets/magalu.png';
import sheinLogo from '../../assets/shein.png';
import tiktokLogo from '../../assets/tiktok.png';

export const marketplaceRules: Record<string, MarketplaceRules> = {
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    dimensions: '1000x1000',
    aspectRatio: '1:1',
    size: { width: 1000, height: 1000 },
    backgroundColor: '#FFFFFF', // Amazon requires pure white (RGB 255,255,255) for main product images.
    maxFileSize: '10MB',
    color: { primary: '#FF9900', shadow: 'rgba(255,153,0,0.35)' },
    logo: amazonLogo,
    requirements: [
      'Fundo branco puro (RGB 255, 255, 255)',
      'Produto em destaque ocupando >= 85% da imagem',
      'Resolução mínima: 1000 pixels no lado maior',
      'Resolução recomendada: 1600-2000 pixels',
      'Formatos aceitos: JPG, PNG, TIFF',
      'Tamanho máximo: 10 MB',
      'Sem textos, gráficos ou selos',
    ],
  },

  mercadolivre: {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    dimensions: '1200x1200',
    aspectRatio: '1:1',
    size: { width: 1200, height: 1200 },
    backgroundColor: '#FFFFFF',
    maxFileSize: '5MB',
    color: { primary: '#FFE600', shadow: 'rgba(255,230,0,0.45)' },
    logo: mercadoLivreLogo,
    requirements: [
      'Fundo branco ou neutro',
      'Produto completo e centralizado',
      'Resolução mínima: 500 x 500 pixels',
      'Resolução recomendada: 1200 x 1200 pixels',
      'Formatos aceitos: JPG, PNG',
      'Tamanho máximo: 5 MB',
      'Sem textos, logotipos ou banners',
    ],
  },

  shopee: {
    id: 'shopee',
    name: 'Shopee',
    dimensions: '1024x1024',
    aspectRatio: '1:1',
    size: { width: 1024, height: 1024 },
    backgroundColor: '#FFFFFF',
    maxFileSize: '2MB',
    color: { primary: '#EE4D2D', shadow: 'rgba(238,77,45,0.35)' },
    logo: shopeeLogo,
    requirements: [
      'Fundo branco ou transparente',
      'Produto centralizado e visível',
      'Resolução mínima: 1024 x 1024 pixels',
      'Formatos aceitos: JPG, PNG',
      'Tamanho máximo: 2 MB',
      'Sem textos ou elementos promocionais',
    ],
  },

  magazineluiza: {
    id: 'magazineluiza',
    name: 'Magazine Luiza',
    dimensions: '1000x1000',
    aspectRatio: '1:1',
    size: { width: 1000, height: 1000 },
    backgroundColor: '#FFFFFF',
    maxFileSize: '5MB',
    color: { primary: '#0086FF', shadow: 'rgba(0,134,255,0.35)' },
    logo: magazineLuizaLogo,
    requirements: [
      'Fundo branco puro',
      'Produto centralizado e sem cortes',
      'Resolução mínima: 1000 x 1000 pixels',
      'Formatos aceitos: JPG, PNG',
      'Tamanho máximo: 5 MB',
      'Sem marcas d\'água, textos ou bordas',
    ],
  },

  shein: {
    id: 'shein',
    name: 'Shein',
    dimensions: '1500x2000',
    aspectRatio: '3:4',
    size: { width: 1500, height: 2000 },
    backgroundColor: '#FFFFFF',
    maxFileSize: '5MB',
    color: { primary: '#000000', shadow: 'rgba(0,0,0,0.35)' },
    logo: sheinLogo,
    requirements: [
      'Proporção 3:4 (retrato)',
      'Resolução mínima: 1500 x 2000 pixels',
      'Fundo branco ou claro',
      'Formatos aceitos: JPG, PNG',
      'Tamanho máximo: 5 MB',
      'Produto bem iluminado e centralizado',
    ],
  },

  tiktok: {
    id: 'tiktok',
    name: 'TikTok Shop',
    dimensions: '800x800',
    aspectRatio: '1:1',
    size: { width: 800, height: 800 },
    backgroundColor: '#FFFFFF',
    maxFileSize: '5MB',
    color: { primary: '#FF0050', shadow: 'rgba(255,0,80,0.35)' },
    logo: tiktokLogo,
    requirements: [
      'Fundo branco ou claro',
      'Produto em destaque, sem cortes',
      'Resolução mínima: 800 x 800 pixels',
      'Formatos aceitos: JPG, PNG',
      'Tamanho máximo: 5 MB',
      'Sem textos ou elementos promocionais',
    ],
  },
};
