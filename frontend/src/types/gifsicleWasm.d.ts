// The package ships the Emscripten glue without types, this covers the
// part the app calls
declare module "gifsicle-wasm" {
  export interface GifsicleModule {
    FS: {
      writeFile(path: string, data: Uint8Array): void;
      readFile(path: string): Uint8Array;
    };
    _malloc(size: number): number;
    _free(pointer: number): void;
    _run_gifsicle(argc: number, argv: number): number;
    stringToNewUTF8(value: string): number;
    setValue(pointer: number, value: number, type: string): void;
  }

  export interface GifsicleOptions {
    locateFile?: (path: string) => string;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
  }

  export default function createGifsicle(
    options?: GifsicleOptions,
  ): Promise<GifsicleModule>;
}
