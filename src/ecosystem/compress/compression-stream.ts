import { Readable, Writable } from "node:stream";
import {
	createBrotliCompress,
	createDeflate,
	createGzip,
	createZstdCompress,
	type ZlibOptions,
} from "node:zlib";

const transformMap = {
	br: createBrotliCompress,
	deflate: createDeflate,
	gzip: createGzip,
	zstd: createZstdCompress,
} as const;

export class CompressionStream {
	readable: ReadableStream;
	writable: WritableStream;

	constructor(
		format: keyof typeof transformMap,
		level: ZlibOptions["level"],
	) {
		const handle = transformMap[format]({
			level,
		});

		this.readable = Readable.toWeb(handle) as unknown as ReadableStream;
		this.writable = Writable.toWeb(handle);
	}
}
