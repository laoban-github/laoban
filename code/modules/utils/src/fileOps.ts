export interface CopyFileFns {
  loadFileOrUrl: ( fileOrUrl: string ) => Promise<string>
  saveFile ( filename: string, text: string ): Promise<void>
}
export interface FileOps extends CopyFileFns {
  digest ( s: string ): string
  createDir: ( dir: string ) => Promise<string | undefined>
  listFiles ( root: string ): Promise<string[]>
  isDirectory ( filename: string ): Promise<boolean>
  isFile ( filename: string ): Promise<boolean>
}
export function lastSegment ( s: string ) {
  const index = s.lastIndexOf ( '/' )
  return index === -1 ? s : s.substring ( index + 1 )
}

interface StringAndExist {
  string: string
  exists: boolean
}

export async function findMatchingK ( list: string[], filter: ( s: string ) => Promise<boolean> ): Promise<string[]> {
  const ps: StringAndExist[] = await Promise.all ( list.map ( string => filter ( string ).then ( exists => ({ exists, string }) ) ) )
  return ps.filter ( se => se.exists ).map ( se => se.string )

}
export const childDirs = ( fileOps: FileOps, stopDirFilter: ( s: string ) => boolean ) => ( root: string ): Promise<string[]> => {
  const children = async ( parent: string ): Promise<string[]> => {
    const addPrefix = ( s1: string ) => ( s2: string ) => s1 === '' ? s2 : s1 + '/' + s2
    const files: string[] = await fileOps.listFiles ( parent )
    const withParent = files.filter ( d => !stopDirFilter ( d ) ).map ( addPrefix ( parent ) )
    const directories: string[] = await findMatchingK ( withParent, fileOps.isDirectory )
    let result: string[] = [ ...directories ]
    let descendents = await Promise.all ( result.map ( children ) )
    descendents.forEach ( c => result.push ( ...c ) )
    return result
  };
  return children ( root )
};

export interface MeteredFileOps extends FileOps {

  digestCount (): number
  lastDigested (): string
  loadFileOrUrlCount (): number
  lastLoadedFile (): string

  createDirCount (): number
  lastCreatedDir (): string

  saveFileCount (): number
  savedFiles (): [ string, string ][]
  lastSavedFileName (): string
  lastSavedFile (): string

  listFilesCount (): number
}
export function fileOpsStats ( fileOps: FileOps ): any {
  const result: any = {}
  if ( isMeteredFileOps ( fileOps ) ) {
    const { saveFileCount, loadFileOrUrlCount, createDirCount } = fileOps
    result.saveFileCount = saveFileCount ()
    result.loadFileOrUrlCount = loadFileOrUrlCount ()
    result.createDirCount = createDirCount ()
  }
  if ( isCachedFileOps ( fileOps ) ) {
    result.cacheHits = fileOps.cacheHits ()
    result.cacheMisses = fileOps.cacheMisses ()
  }
  return result
}
export function isMeteredFileOps ( fileOps: FileOps ): fileOps is MeteredFileOps {
  const a: any = fileOps
  return a.digestCount !== undefined
}
export function meteredFileOps ( fileOps: FileOps ): MeteredFileOps {
  if ( isMeteredFileOps ( fileOps ) ) return fileOps
  var digestCount: number = 0;
  var lastDigested: string = undefined

  var loadFileOrUrlCount: number = 0;
  var lastLoadedFile: string = undefined
  var createDirCount: number = 0;
  var lastCreatedDir: string = undefined;
  var saveFileCount: number = 0;
  var lastSavedFileName: string = undefined;
  var lastSavedFile: string = undefined;
  var listFilesCount: number = 0
  var savedFiles: [ string, string ][] = []
  return {
    ...fileOps,
    createDirCount: () => createDirCount,
    digestCount: () => digestCount,
    lastCreatedDir: () => lastCreatedDir,
    lastSavedFile: () => lastSavedFile,
    lastSavedFileName: () => lastSavedFileName,
    lastDigested: () => lastDigested,
    lastLoadedFile: () => lastLoadedFile,
    loadFileOrUrlCount: () => loadFileOrUrlCount,
    saveFileCount: () => saveFileCount,
    listFilesCount: () => listFilesCount,
    savedFiles: () => savedFiles,

    createDir ( dir: string ): Promise<string | undefined> {
      createDirCount += 1
      lastCreatedDir = dir
      return fileOps.createDir ( dir );
    },
    loadFileOrUrl ( fileOrUrl: string ): Promise<string> {
      loadFileOrUrlCount += 1
      lastLoadedFile = fileOrUrl
      return fileOps.loadFileOrUrl ( fileOrUrl )
    },
    digest ( s: string ): string {
      digestCount += 1
      lastDigested = s
      return fileOps.digest ( s );
    },
    listFiles ( root: string ): Promise<string[]> {
      listFilesCount += 1
      return fileOps.listFiles ( root )
    },
    saveFile ( filename: string, text: string ): Promise<void> {
      saveFileCount += 1
      lastSavedFile = text
      lastSavedFileName = filename
      savedFiles.push ( [ filename, text ] )
      return fileOps.saveFile ( filename, text )
    }
  }
}


export const emptyFileOps: FileOps = {
  createDir (): Promise<string | undefined> {return Promise.resolve ( undefined );},
  loadFileOrUrl (): Promise<string> {return Promise.resolve ( "" );},
  digest (): string {return "";},
  listFiles (): Promise<string[]> {return Promise.resolve ( [] );},
  saveFile (): Promise<void> {return Promise.resolve ();},
  isDirectory ( filename: string ): Promise<boolean> {return Promise.resolve ( false )},
  isFile: ( filename: string ): Promise<boolean> => {return Promise.resolve ( false )}

}

export function cachedLoad ( fileOps: FileOps, cache: string, ops: PrivateCacheFileOps ): ( fileOrUrl: string ) => Promise<string> {
  if ( cache === undefined ) return fileOps.loadFileOrUrl
  return fileOrUrl => {
    if ( !fileOrUrl.includes ( '://' ) ) return fileOps.loadFileOrUrl ( fileOrUrl )
    const digest = fileOps.digest ( fileOrUrl );
    const cached = cache + '/' + digest
    return fileOps.loadFileOrUrl ( cached ).then ( result => {
        ops.cacheHit ();
        return result;
      },
      async () => {
        ops.cacheMiss ()
        await fileOps.createDir ( cache )
        const result = await fileOps.loadFileOrUrl ( fileOrUrl )
        return fileOps.saveFile ( cached, result ).then ( () => result )
      } )
  }
}

export interface CachedFileOps extends FileOps {
  original: FileOps
  cached: true
  cacheHits (): number,
  cacheMisses (): number
}

export interface PrivateCacheFileOps {
  cacheHit (),
  cacheMiss ()
}

export function nonCached ( f: FileOps ): FileOps {
  return isCachedFileOps ( f ) ? f.original : f
}
export function isCachedFileOps ( f: FileOps ): f is CachedFileOps {
  const a: any = f
  return a.cached === true
}

export function cachedFileOps ( fileOps: FileOps, cache: string | undefined ): FileOps | CachedFileOps {
  if ( cache === undefined || isCachedFileOps ( fileOps ) ) return fileOps
  var cacheHits = 0
  var cacheMisses = 0
  var ops: PrivateCacheFileOps = { cacheHit: () => cacheHits += 1, cacheMiss: () => cacheMisses += 1 }
  let result: CachedFileOps = { ...fileOps, loadFileOrUrl: cachedLoad ( fileOps, cache, ops ), cached: true, cacheMisses: () => cacheMisses, cacheHits: () => cacheHits, original: fileOps };
  return result
}

export type CopyFileDetails = string

export function copyFile ( fileOps: FileOps, rootUrl: string, target: string ): ( fd: CopyFileDetails ) => Promise<void> {
  return ( offset ) => fileOps.loadFileOrUrl ( rootUrl + '/' + offset )
    .then ( file => fileOps.saveFile ( target + '/' + offset, file ) )
}
export function copyFiles ( context: string, fileOps: FileOps, rootUrl: string, target: string ): ( fs: CopyFileDetails[] ) => Promise<void> {
  const cf = copyFile ( fileOps, rootUrl, target )
  return fs => Promise.all ( fs.map ( f => cf ( f ).catch ( e => {
    console.error ( e );
    throw Error ( `Error ${context}\nFile ${f}\n${e}` )
  } ) ) ).then ( () => {} )
}
