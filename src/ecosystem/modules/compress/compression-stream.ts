import { Duplex } from "node:stream";
import {
	type BrotliOptions,
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
		method: keyof typeof transformMap,
		options: BrotliOptions & ZlibOptions & { dictionary?: Buffer } = {},
	) {
		const pair = Duplex.toWeb(transformMap[method](options));

		this.readable = pair.readable as unknown as ReadableStream;
		this.writable = pair.writable;
	}
}
