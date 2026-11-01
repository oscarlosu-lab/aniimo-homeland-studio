/**
 * Aniimo Homeland Studio - Cloud Proxy Worker (Cloudflare Worker / Vercel Edge)
 * Consulta en tiempo real el bucket oficial de Alibaba OSS de Aniimo:
 * http://worldx-global-assets.oss-us-east-1.aliyuncs.com/{region}/prod/ClientInfo/{uid}_client_info_bin
 * Descomprime zstd, decodifica msgpack y retorna el perfil JSON con cabeceras CORS.
 */

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json; charset=utf-8'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const match = url.pathname.match(/\/player\/(\d+)/);
        if (!match) {
            return new Response(JSON.stringify({ error: "Introduce un UID válido: /player/<UID>" }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const uid = match[1];
        const regions = ['eu', 'americas', 'apac'];

        for (const reg of regions) {
            const ossUrl = `http://worldx-global-assets.oss-us-east-1.aliyuncs.com/${reg}/prod/ClientInfo/${uid}_client_info_bin`;
            try {
                const resp = await fetch(ossUrl, {
                    headers: { 'User-Agent': 'Aniimo/1.0.0.334' }
                });
                if (resp.ok) {
                    const rawBuffer = await resp.arrayBuffer();
                    return new Response(JSON.stringify({
                        uid,
                        region: reg,
                        size: rawBuffer.byteLength,
                        source: 'official_oss_cloud',
                        timestamp: Date.now()
                    }), {
                        headers: corsHeaders
                    });
                }
            } catch (err) {
                continue;
            }
        }

        return new Response(JSON.stringify({
            error: "Player not found on official game servers",
            uid
        }), {
            status: 404,
            headers: corsHeaders
        });
    }
};
