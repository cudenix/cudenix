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

	constructor(method: keyof typeof transformMap, options: ZlibOptions = {}) {
		const handle = transformMap[method](options);

		this.readable = Readable.toWeb(handle) as unknown as ReadableStream;
		this.writable = Writable.toWeb(handle);
	}
}
