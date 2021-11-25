import { Body } from './Body';
import { Headers } from './Headers';

class RequestPonyfill extends Body implements Request {
    public cache = 'default' as const;
    public credentials = 'include' as const;
    public destination = '' as const;
    public headers: Headers;
    public integrity = '';
    public keepalive = true;
    public method: string;
    public mode = 'no-cors' as const;
    public redirect = 'follow' as const;
    public referrer = '';
    public referrerPolicy = '' as const;
    public signal = {} as any;
    public url: string;
    constructor(
        info: RequestInfo,
        init?: RequestInit
    ) {
        super((typeof info === 'string' ? init?.body : info.body) || null);
        this.url = typeof info === 'string' ? info : info.url;
        this.method = (typeof info === 'string' ? init?.method : info.method) || 'GET';
        this.headers = new Headers((typeof info === 'string' ? init?.headers : info.headers) || {});
    }

    clone(): Request {
        return new Request(this);
    }
}

export const Request: typeof globalThis.Request =
    globalThis.Request || RequestPonyfill;
