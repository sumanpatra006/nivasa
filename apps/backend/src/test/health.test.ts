import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';
import type { ServerResponse } from 'http';
import { Socket } from 'net';
import http from 'http';

describe('Health API Integration Test', () => {
  const app = createApp();

  function dispatch(method: string, url: string): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const req = new http.IncomingMessage(socket);
      req.method = method;
      req.url = url;
      req.headers = { host: 'localhost' };

      let statusCode = 200;
      let responseData = '';

      const res = {
        setHeader: () => res,
        getHeader: () => undefined,
        writeHead: (code: number) => {
          statusCode = code;
          return res;
        },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          resolve({ status: statusCode, body: data });
          return res;
        },
        send: (data: any) => {
          resolve({ status: statusCode, body: data });
          return res;
        },
        end: (chunk?: any) => {
          if (chunk) responseData += chunk;
          try {
            resolve({ status: statusCode, body: JSON.parse(responseData) });
          } catch {
            resolve({ status: statusCode, body: responseData });
          }
        },
      } as unknown as ServerResponse;

      app(req, res);
    });
  }

  it('GET /api/v1/health returns 200 OK with health status', async () => {
    const res = await dispatch('GET', '/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'nivasa-api');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/unknown-route returns 404', async () => {
    const res = await dispatch('GET', '/api/v1/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });
});
