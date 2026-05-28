import { POST } from '@/app/api/packing/scan/route';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getAuthUser: async () => ({ id: 1, username: 'test' })
}));

jest.mock('@/lib/db', () => ({
  getDb: () => ({
    transaction: async (fn: any) => fn(),
    prepare: () => ({
      get: () => null,
      run: () => {},
      all: () => []
    })
  }),
  logAudit: async () => {}
}));

test('POST /api/packing/scan returns success for valid barcode', async () => {
  const mockRequest = new Request('http://localhost/api/packing/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode: 'ART|RED|5' })
  });

  const response = await POST(mockRequest) as any;
  const json = await response.json();
  expect(response.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.product).toMatchObject({ article: 'ART', colour: 'RED', size: '5' });
});
