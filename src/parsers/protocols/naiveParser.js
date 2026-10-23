import { parseBool } from '../../utils.js';

function getFirstParam(searchParams, keys) {
    for (const key of keys) {
        if (searchParams.has(key)) {
            return searchParams.get(key);
        }
    }
    return undefined;
}

function decodeComponent(value) {
    try {
        return decodeURIComponent(value);
    } catch (_) {
        return value;
    }
}

export function parseNaive(url) {
    const parsedUrl = new URL(url);
    // The transport lives in the scheme, not a query parameter: naive+quic is
    // HTTP/3, naive+https (and a bare naive://) is HTTP/2 over TLS.
    const scheme = parsedUrl.protocol.toLowerCase();
    if (!['naive:', 'naive+https:', 'naive+quic:'].includes(scheme)) {
        return undefined;
    }
    const quic = scheme === 'naive+quic:';

    const server = parsedUrl.hostname.startsWith('[') && parsedUrl.hostname.endsWith(']')
        ? parsedUrl.hostname.slice(1, -1)
        : parsedUrl.hostname;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;
    const username = decodeComponent(parsedUrl.username);
    const password = decodeComponent(parsedUrl.password);
    const fragment = decodeComponent(parsedUrl.hash.slice(1));
    const defaultTagServer = server.includes(':') ? `[${server}]` : server;
    const params = parsedUrl.searchParams;

    const tls = {
        enabled: true,
        insecure: parseBool(
            getFirstParam(params, ['insecure', 'skip-cert-verify', 'allowInsecure', 'allow_insecure']),
            false
        )
    };
    const serverName = getFirstParam(params, ['sni', 'servername', 'host']);
    if (serverName) {
        tls.server_name = serverName;
    }

    return {
        tag: fragment || `Naive ${defaultTagServer}:${port}`,
        type: 'naive',
        server,
        server_port: port,
        ...(username ? { username } : {}),
        ...(password ? { password } : {}),
        ...(quic ? { quic: true } : {}),
        tls
    };
}
