/**
 * history.pagination.test.ts — Testa a paginação no HistoryController
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

process.env.NODE_ENV = 'test';

vi.mock('../database/prisma.js', () => ({
  prisma: {
    processedImage: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../shared/storage/historyStore.js', () => ({
  listImages: vi.fn(),
  removeImage: vi.fn(),
  clearImages: vi.fn(),
}));

describe('HistoryController — paginação', () => {
  let controller: import('../modules/history/HistoryController.js').HistoryController;
  let mockFindMany: ReturnType<typeof vi.fn>;
  let mockCount: ReturnType<typeof vi.fn>;

  const makeReq = (query: Record<string, string> = {}): Partial<Request> => ({
    query,
    userId: 'user-test-1',
    params: {},
  });

  const makeRes = () => {
    const res = {} as Partial<Response>;
    res.json = vi.fn().mockReturnValue(res) as unknown as Response['json'];
    res.status = vi.fn().mockReturnValue(res) as unknown as Response['status'];
    return res;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../modules/history/HistoryController.js');
    controller = new mod.HistoryController();
    const { prisma } = await import('../database/prisma.js');
    mockFindMany = prisma.processedImage.findMany as ReturnType<typeof vi.fn>;
    mockCount = prisma.processedImage.count as ReturnType<typeof vi.fn>;
  });

  it('deve retornar estrutura paginada com dados corretos', async () => {
    const fakeItems = Array.from({ length: 5 }, (_, i) => ({
      id: `id-${i}`,
      fileName: `file${i}.jpg`,
      finalName: `final${i}.png`,
      marketplace: 'amazon',
      width: 1000,
      height: 1000,
      s3Key: null,
      s3Url: null,
      createdAt: new Date(),
    }));

    mockFindMany.mockResolvedValue(fakeItems);
    mockCount.mockResolvedValue(23);

    const req = makeReq({ page: '1', limit: '5' });
    const res = makeRes();

    await controller.list(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ id: 'id-0' })]),
        total: 23,
        page: 1,
        limit: 5,
        totalPages: 5,
      })
    );
  });

  it('deve limitar `limit` a 100 no máximo', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = makeReq({ page: '1', limit: '999' });
    const res = makeRes();

    await controller.list(req as Request, res as Response);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it('deve usar defaults page=1 limit=50 quando não informados', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = makeReq({});
    const res = makeRes();

    await controller.list(req as Request, res as Response);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 50 })
    );
  });

  it('deve calcular totalPages corretamente para divisão não exata', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(11);

    const req = makeReq({ page: '1', limit: '5' });
    const res = makeRes();

    await controller.list(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalPages: 3 })
    );
  });

  it('deve calcular skip correto para página 3 com limit 10', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(100);

    const req = makeReq({ page: '3', limit: '10' });
    const res = makeRes();

    await controller.list(req as Request, res as Response);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });
});
