import { expect, test } from 'vitest';
import { decodeJwtPayload } from '../api/client';

test('decodeJwtPayload decodes standard JWT payload', () => {
  // Payload: {"sub":"user1","tenant_id":"123"} -> eyJzdWIiOiJ1c2VyMSIsInRlbmFudF9pZCI6IjEyMyJ9
  const token = 'header.eyJzdWIiOiJ1c2VyMSIsInRlbmFudF9pZCI6IjEyMyJ9.signature';
  const payload = decodeJwtPayload(token);
  expect(payload.sub).toBe('user1');
  expect(payload.tenant_id).toBe('123');
});

test('decodeJwtPayload handles base64url characters hyphen and underscore with unpadded length', () => {
  // Payload with - and _ chars in base64url:
  // {"tenant_id":"00000000-0000-0000-0000-000000000001","sub":"test_user-123"}
  // Base64URL encoded payload: eyJ0ZW5hbnRfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJzdWIiOiJ0ZXN0X3VzZXItMTIzIn0
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0ZW5hbnRfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJzdWIiOiJ0ZXN0X3VzZXItMTIzIn0.signature';

  const payload = decodeJwtPayload(token);
  expect(payload.tenant_id).toBe('00000000-0000-0000-0000-000000000001');
  expect(payload.sub).toBe('test_user-123');
});
