import type { Context } from '@netlify/functions';
import serverless from 'serverless-http';

// Translate the Fetch API to the existing Express app without opening a port.
export default async (request: Request, context: Context) => {
  process.env.TESTCRAFT_SERVERLESS = 'true';
  process.env.NODE_ENV = 'production';
  const { default: app } = await import('../../server/index.js');
  const handler = serverless(app, { binary: true });
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/\.netlify\/functions\/api(?=\/|$)/, '') || '/';
  const body = Buffer.from(await request.arrayBuffer());
  const result = await handler({
    httpMethod: request.method,
    path,
    rawUrl: request.url,
    headers: Object.fromEntries(request.headers),
    multiValueQueryStringParameters: Object.fromEntries(
      [...new Set(url.searchParams.keys())].map(key => [key, url.searchParams.getAll(key)]),
    ),
    body: body.length ? body.toString('base64') : null,
    isBase64Encoded: true,
    requestContext: { identity: { sourceIp: context.ip } },
  }, {}) as { statusCode: number; headers: Record<string, string>; body: string; isBase64Encoded: boolean };
  return new Response(request.method === 'HEAD' || result.statusCode === 204 ? null :
    result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body, {
    status: result.statusCode,
    headers: result.headers,
  });
};
