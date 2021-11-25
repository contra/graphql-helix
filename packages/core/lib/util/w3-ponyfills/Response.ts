import { Headers } from './Headers';
import { Body } from './Body';

class ResponsePonyfill extends Body implements Response {
    public headers: Headers;
    public status: number;
    public statusText: string;
    public ok: boolean;
    public type = 'basic' as const;
    public url = '';
    public redirected = false;
    constructor(
        body: BodyInit | null,
        init?: ResponseInit
    ) {
        super(body);
        this.headers = new Headers(init?.headers || {});
        this.status = init?.status ?? 200;
        this.statusText = init?.statusText ?? "OK";
        this.ok = this.status >= 200 && this.status < 300;
    }

    clone(): Response {
        return new Response(super.body, this)
    }
}

export const Response: typeof globalThis.Response = globalThis.Response || ResponsePonyfill;
