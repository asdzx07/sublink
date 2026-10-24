const collectionCache = new WeakMap();

function defaultGetName(item) {
    return item?.name || item?.tag || '';
}

function defaultSetName(item, name) {
    if (item) {
        if ('name' in item) {
            item.name = name;
        } else if ('tag' in item) {
            item.tag = name;
        }
    }
}

function defaultIsSame(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Physical identity of a proxy: same endpoint + account, regardless of how
// the same node was described (name, TLS fingerprint, transport path, SNI
// and other presentation fields differ across link/YAML exports of one node).
// Transport details are intentionally left out: they change the description,
// not the endpoint the client selects. Returns null when the proxy carries
// too little identity to fingerprint safely, so callers fall back to a
// full-object comparison instead of merging unrelated nodes.
export function proxyFingerprint(proxy) {
    if (!proxy || typeof proxy !== 'object') return null;
    const rawServer = proxy.server || proxy.address || proxy.hostname;
    if (typeof rawServer !== 'string' || !rawServer.trim()) return null;
    const server = rawServer.trim().toLowerCase().replace(/^\[|\]$/g, '');
    const type = String(proxy.type || '').toLowerCase();
    const port = proxy.port ?? proxy.server_port ?? '';
    const credential = [proxy.uuid, proxy.password]
        .filter(value => value !== undefined && value !== null && value !== '')
        .join(':') || (proxy.username ? `${proxy.username}:${proxy.password || ''}` : '');
    // Without a port or a credential, a bare server name alone is not enough
    // to tell two accounts on one host apart.
    if (port === '' && !credential) return null;
    const cipher = type === 'ss' || type === 'shadowsocks'
        ? (proxy.cipher || proxy.method || '')
        : '';
    return [type, server, String(port), credential, cipher].join('|');
}

// Fingerprint equality with a full-object fallback for unfingerprintable
// proxies, so a fingerprint miss never merges nodes it cannot identify.
export function isSamePhysicalProxy(a, b) {
    const fingerprintA = proxyFingerprint(a);
    const fingerprintB = proxyFingerprint(b);
    if (fingerprintA !== null && fingerprintB !== null) {
        return fingerprintA === fingerprintB;
    }
    const { name: _aName, tag: _aTag, ...restA } = a || {};
    const { name: _bName, tag: _bTag, ...restB } = b || {};
    return JSON.stringify(restA) === JSON.stringify(restB);
}

function getOrInitCollectionMeta(collection, getName, isSame, getSignature) {
    let meta = collectionCache.get(collection);
    // If collection was mutated externally or meta is missing, re-sync cache
    if (!meta || meta.lastLength !== collection.length) {
        const usedNames = new Set();
        const signatureSet = new Set();
        const customSignatures = new Set();
        const isDefaultSame = isSame === defaultIsSame;

        for (let i = 0; i < collection.length; i++) {
            const name = getName(collection[i]);
            if (name) usedNames.add(name);
            if (isDefaultSame) {
                signatureSet.add(defaultIsSameSignature(collection[i]));
            }
            if (typeof getSignature === 'function') {
                customSignatures.add(getSignature(collection[i]));
            }
        }

        meta = {
            usedNames,
            signatureSet,
            customSignatures,
            lastLength: collection.length,
            isDefaultSame
        };
        collectionCache.set(collection, meta);
    }
    return meta;
}

function defaultIsSameSignature(item) {
    return JSON.stringify(item);
}

export function addProxyWithDedup(collection, proxy, { getName = defaultGetName, setName = defaultSetName, isSame = defaultIsSame, getSignature } = {}) {
    if (!proxy) return;
    if (!Array.isArray(collection)) {
        throw new Error('addProxyWithDedup expects the target collection to be an array');
    }

    let candidate = proxy;
    const targetName = getName(candidate) || '';
    const meta = getOrInitCollectionMeta(collection, getName, isSame, getSignature);

    // Fast path: if using default equality check or getSignature provided, check Set in O(1)
    if (getSignature) {
        const sig = getSignature(candidate);
        if (meta.customSignatures && meta.customSignatures.has(sig)) {
            return;
        }
    } else if (meta.isDefaultSame) {
        const sig = defaultIsSameSignature(candidate);
        if (meta.signatureSet.has(sig)) {
            return;
        }
    } else {
        const hasIdentical = collection.some(item => isSame(item, candidate));
        if (hasIdentical) {
            return;
        }
    }

    // Rename duplicates using cached Set in O(1) amortized
    if (meta.usedNames.has(targetName) && typeof setName === 'function' && targetName) {
        let suffix = 2;
        while (meta.usedNames.has(`${targetName} ${suffix}`)) suffix += 1;
        const updated = setName(candidate, `${targetName} ${suffix}`);
        if (typeof updated !== 'undefined') {
            candidate = updated;
        }
    }

    const finalName = getName(candidate) || '';
    if (finalName) {
        meta.usedNames.add(finalName);
    }
    if (getSignature) {
        meta.customSignatures = meta.customSignatures || new Set();
        meta.customSignatures.add(getSignature(candidate));
    } else if (meta.isDefaultSame) {
        meta.signatureSet.add(defaultIsSameSignature(candidate));
    }

    collection.push(candidate);
    meta.lastLength = collection.length;
}
