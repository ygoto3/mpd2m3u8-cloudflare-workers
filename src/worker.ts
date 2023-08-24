import { IMpdParser, MpdParser, Mpd2M3u8 } from "manifest-manipulator";

const EXT_M3U8 = '.m3u8';
const EXT_MPD = '.mpd';

export interface Env {
	MEDIA_ORIGIN: string;
	MPD_FILE_NAME: string;
	MULTIVARIANT_M3U8_FILE_NAME: string;
	MEDIA_M3U8_FILE_PREFIX: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (!url.pathname.endsWith(EXT_M3U8))
			return new Response('Not Found', { status: 404 });

		let uriPrefix = '';
		let streamName = '';

		if (url.pathname.includes(env.MULTIVARIANT_M3U8_FILE_NAME + EXT_M3U8)) {
			const idx = url.pathname.indexOf(env.MULTIVARIANT_M3U8_FILE_NAME + EXT_M3U8);
			uriPrefix = url.pathname.substring(0, idx);
		} else if (url.pathname.includes(env.MEDIA_M3U8_FILE_PREFIX)) {
			const idx = url.pathname.indexOf(env.MEDIA_M3U8_FILE_PREFIX);
			uriPrefix = url.pathname.substring(0, idx);
			const idx2 = url.pathname.indexOf(EXT_M3U8);
			streamName = url.pathname.substring(idx, idx2);
		} else {
			return new Response('Not Found', { status: 404 });
		}

		const mpdUrl = env.MEDIA_ORIGIN + uriPrefix + env.MPD_FILE_NAME + EXT_MPD;
		const res = await fetch(mpdUrl, {
			cf: {
				cacheKey: mpdUrl,
				cacheTtlByStatus: { "200-299": 300, 404: 1, "500-599": 0 },
			},
		});

		if (res.status !== 200)
			return new Response('Not Found', { status: 404 });

		const mpd = await res.text();

		const mpdParser: IMpdParser = new MpdParser();
		mpdParser.parse(mpd);

		if (!mpdParser.mpd)
			return new Response('Internal Server Error', { status: 500 });
		
		const m3u8 = new Mpd2M3u8(mpdParser.mpd).m3u8;

		if (!m3u8)
			return new Response('Internal Server Error', { status: 500 });

		if (streamName === '') {
			const multivariantPlaylist = m3u8.m3u8;
			if (!multivariantPlaylist)
				return new Response('Not Found', { status: 404 });
			return new Response(multivariantPlaylist);
		} else {
			const mediaPlaylist = m3u8.getMediaPlaylistByName(streamName);
			if (!mediaPlaylist)
				return new Response('Not Found', { status: 404 });
			mediaPlaylist.baseUrl = env.MEDIA_ORIGIN + uriPrefix;
			return new Response(mediaPlaylist.m3u8);
		}
	},
};