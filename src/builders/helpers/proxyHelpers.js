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

function getOrInitCollectionMeta(collection, getName, isSame) {
    let meta = collectionCache.get(collection);
    // If collection was mutated externally or meta is missing, re-sync cache
    if (!meta || meta.lastLength !== collection.length) {
        const usedNames = new Set();
        const signatureSet = new Set();
        const isDefaultSame = isSame === defaultIsSame;

        for (let i = 0; i < collection.length; i++) {
            const name = getName(collection[i]);
            if (name) usedNames.add(name);
            if (isDefaultSame) {
                signatureSet.add(defaultIsSameSignature(collection[i]));
            }
        }

        meta = {
            usedNames,
            signatureSet,
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
    const meta = getOrInitCollectionMeta(collection, getName, isSame);

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
