class HeadersPonyfill implements Headers {
    private headersMap = new Map<string, string[]>();

    constructor(init: HeadersInit) {
        if (Array.isArray(init)) {
            for (const [name, value] of init) {
                this.append(name, value);
            }
        } else if (typeof init.forEach === 'function') {
            init.forEach((value, name) => {
                this.append(name, value);
            });
        } else {
            for (const key in init) {
                this.append(key, (init as Record<string, string>)[key]);
            }
        }
    }

    get(name: string) {
        const values = this.headersMap.get(name.toLowerCase());
        if (values) {
            return values.join(',');
        }
        return null;
    }

    set(name: string, value: string) {
        this.headersMap.set(name.toLowerCase(), [value]);
    }

    append(name: string, value: string) {
        let values = this.headersMap.get(name.toLowerCase());
        if (!values) {
            values = [];
            this.headersMap.set(name.toLowerCase(), values);
        }
        values.push(value);
    }

    has(name: string) {
        return this.headersMap.has(name.toLowerCase());
    }

    delete(name: string) {
        this.headersMap.delete(name.toLowerCase());
    }

    forEach(fn: (value: string, name: string, headers: Headers) => void) {
        this.headersMap.forEach((values, name) => {
            for (const value of values) {
                fn(value, name, this);
            }
        });
    }
}

export const Headers: typeof globalThis.Headers = globalThis.Headers || HeadersPonyfill;