import { createApp } from '../app.js';
import type { ServerResponse } from 'http';
import { Socket } from 'net';
import http from 'http';

export interface DispatchOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  token?: string;
  headers?: Record<string, string>;
}

export interface DispatchResponse {
  status: number;
  body: any;
  headers: Record<string, any>;
}

const app = createApp();

/**
 * Dispatches an HTTP request directly to the Express application without opening TCP sockets.
 * Avoids EACCES sandbox permission issues on Windows.
 */
export function dispatchRequest(options: DispatchOptions): Promise<DispatchResponse> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = options.method;
    req.url = options.url;
    req.headers = {
      host: 'localhost',
      'content-type': 'application/json',
      ...(options.headers || {}),
    };

    if (options.token) {
      req.headers['authorization'] = `Bearer ${options.token}`;
    }

    let statusCode = 200;
    const responseHeaders: Record<string, any> = {};
    let responseData = '';

    const res = {
      setHeader: (name: string, value: any) => {
        responseHeaders[name.toLowerCase()] = value;
        return res;
      },
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
      writeHead: (code: number, headers?: any) => {
        statusCode = code;
        if (headers) {
          Object.assign(responseHeaders, headers);
        }
        return res;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        resolve({ status: statusCode, body: data, headers: responseHeaders });
        return res;
      },
      send: (data: any) => {
        if (typeof data === 'object') {
          resolve({ status: statusCode, body: data, headers: responseHeaders });
        } else {
          try {
            resolve({ status: statusCode, body: JSON.parse(data), headers: responseHeaders });
          } catch {
            resolve({ status: statusCode, body: data, headers: responseHeaders });
          }
        }
        return res;
      },
      end: (chunk?: any) => {
        if (chunk) responseData += chunk;
        try {
          resolve({ status: statusCode, body: JSON.parse(responseData), headers: responseHeaders });
        } catch {
          resolve({ status: statusCode, body: responseData, headers: responseHeaders });
        }
      },
    } as unknown as ServerResponse;

    // Simulate incoming body stream for POST/PATCH
    if (options.body !== undefined) {
      const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.headers['content-length'] = Buffer.byteLength(bodyStr).toString();
      
      app(req, res);
      
      // Push body chunks into request stream
      req.push(bodyStr);
      req.push(null);
    } else {
      app(req, res);
      req.push(null);
    }
  });
}

