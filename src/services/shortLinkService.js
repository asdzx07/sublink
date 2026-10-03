import { generateWebPath } from '../utils.js';
import { MissingDependencyError } from './errors.js';

export class ShortLinkService {
    constructor(kv, options = {}) {
        this.kv = kv;
        this.options = options;
    }

    ensureKv() {
        if (!this.kv) {
            throw new MissingDependencyError('Short link service requires a KV store');
        }
        return this.kv;
    }

    async createShortLink(queryString, providedCode, ttlSeconds) {
        const kv = this.ensureKv();
        const shortCode = providedCode || generateWebPath();
        // Per-request TTL takes precedence over the global default; 0 means no expiry
        const ttl = ttlSeconds !== undefined ? ttlSeconds : this.options.shortLinkTtlSeconds;
        const putOptions = ttl ? { expirationTtl: ttl } : undefined;
        await kv.put(shortCode, queryString, putOptions);
        return shortCode;
    }

    async resolveShortCode(code) {
        const kv = this.ensureKv();
        return kv.get(code);
    }
}
