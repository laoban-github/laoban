import { DebugCommands } from "@phil-rice/debug";
import { NameAnd, safeArray } from "./utils";

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
  removeDirectory ( filename: string, recursive: boolean ): Promise<void>
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

  removeDirectoryCount (): number
  lastRemoveDirectory (): string
}
export function fileOpsStats ( fileOps: FileOps ): any {
  const result: any = {}
  if ( isMeteredFileOps ( fileOps ) ) {
    const { saveFileCount, loadFileOrUrlCount, createDirCount, removeDirectoryCount } = fileOps
    result.saveFileCount = saveFileCount ()
    result.loadFileOrUrlCount = loadFileOrUrlCount ()
    result.createDirCount = createDirCount ()
    result.removeDirectoryCount = removeDirectoryCount ()
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
  let digestCount: number = 0;
  let lastDigested: string = undefined

  let loadFileOrUrlCount: number = 0;
  let lastLoadedFile: string = undefined
  let createDirCount: number = 0;
  let lastCreatedDir: string = undefined;
  let saveFileCount: number = 0;
  let lastSavedFileName: string = undefined;
  let lastSavedFile: string = undefined;
  let listFilesCount: number = 0
  let savedFiles: [ string, string ][] = []
  let removeDirectoryCount: number = 0
  let lastRemoveDirectory: string = undefined

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
    removeDirectoryCount: () => removeDirectoryCount,
    lastRemoveDirectory: (): string => lastRemoveDirectory,
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
    },
    removeDirectory ( filename: string, recursive: boolean ): Promise<void> {
      removeDirectoryCount += 1
      lastRemoveDirectory = filename
      return fileOps.removeDirectory ( filename, recursive )
    }
  }
}


export const emptyFileOps: FileOps = {
  createDir (): Promise<string | undefined> {return Promise.resolve ( undefined );},
  loadFileOrUrl (): Promise<string> {return Promise.resolve ( "" );},
  digest (): string {return "";},
  listFiles (): Promise<string[]> {return Promise.resolve ( [] );},
  saveFile (): Promise<void> {return Promise.resolve ();},
  isDirectory (): Promise<boolean> {return Promise.resolve ( false )},
  isFile: (): Promise<boolean> => {return Promise.resolve ( false )},
  removeDirectory: (): Promise<void> => Promise.resolve ()
}

export function shortCutFileOps ( fileOps: FileOps, nameAndPrefix: NameAnd<string> ): FileOps {
  function processFile ( s: string ): string {
    return s.replace ( /^@([^@]*)@/g, ( full ) => {
      let name = full.slice ( 1, -1 );
      const result = nameAndPrefix[ name ]
      if ( result === undefined )
        throw new Error ( `Cannot handle filename ${s}. It has the @${name}@. Legal names are ${Object.keys ( nameAndPrefix )}` )
      return result
    } )
  }
  return {
    digest: fileOps.digest,
    isFile: ( filename: string ) => fileOps.isFile ( processFile ( filename ) ),
    isDirectory: ( filename: string ) => fileOps.isDirectory ( processFile ( filename ) ),
    removeDirectory: ( filename: string, recursive: boolean ) => fileOps.removeDirectory ( processFile ( filename ), recursive ),
    loadFileOrUrl: ( fileOrUrl ) => fileOps.loadFileOrUrl ( processFile ( fileOrUrl ) ),
    createDir: dir => fileOps.createDir ( processFile ( dir ) ),
    saveFile: ( filename: string, text: string ) => fileOps.saveFile ( processFile ( filename ), text ),
    listFiles: ( root: string ) => fileOps.listFiles ( processFile ( root ) )

  }
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
  cacheDir: string
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

export function cachedFileOps ( fileOps: FileOps, cacheDir: string | undefined ): FileOps | CachedFileOps {
  if ( cacheDir === undefined || isCachedFileOps ( fileOps ) ) return fileOps
  let cacheHits = 0
  let cacheMisses = 0
  let ops: PrivateCacheFileOps = { cacheHit: () => cacheHits += 1, cacheMiss: () => cacheMisses += 1 }
  return {
    ...fileOps, loadFileOrUrl: cachedLoad ( fileOps, cacheDir, ops ),
    cached: true, cacheMisses: () => cacheMisses, cacheHits: () => cacheHits, original: fileOps, cacheDir
  }
}

interface TemplateFileDetails {
  file: string
  target?: string
  type: string
  postProcess?: string | string[]
}
const postProcessOne = ( context: string ) => ( text: string, p: string ): string => {
  if ( p === 'json' ) try {
    return JSON.stringify ( JSON.parse ( text ), null, 2 )
  } catch ( e ) {
    console.error ( `Cannot parse post processing json ${context}`, e )
    throw e
  }
  if ( p.match ( /^checkEnv\(.*\)$/ ) ) {
    const env = p.slice ( 9, -1 )
    if ( process.env[ env ] === undefined ) console.error ( `${context}\n    requires the env variable [${env} to exist and it doesn't. This might cause problems]` )
    return text
  }
  throw Error ( `${context}. Don't know how to post process with ${p}. Legal values are 'json' and 'checkEnv(xxx) - which checks the environment variable has a value` )
};
function postProcess ( context: string, t: CopyFileDetails, text: string ): string {
  if ( !isTemplateFileDetails ( t ) ) return text
  return safeArray ( t.postProcess ).reduce ( postProcessOne ( context ), text )
}

export function isTemplateFileDetails ( t: CopyFileDetails ): t is TemplateFileDetails {
  const a: any = t
  return a.file !== undefined
}
export function fileNameFrom ( f: CopyFileDetails ): string {
  if ( isTemplateFileDetails ( f ) ) return f.file
  if ( typeof f === 'string' ) return f
  throw new Error ( `Cannot find file name in [${JSON.stringify ( f )}]` )
}
export function targetFrom ( f: CopyFileDetails ): string {
  if ( isTemplateFileDetails ( f ) ) return f.target ? f.target : f.file
  if ( typeof f === 'string' ) return f
  throw new Error ( `Cannot find target in [${JSON.stringify ( f )}]` )
}


export type CopyFileDetails = string | TemplateFileDetails

export function copyFileAndTransform ( fileOps: FileOps, d: DebugCommands, rootUrl: string, targetRoot: string, tx?: ( type: string, text: string ) => Promise<string> ): ( fd: CopyFileDetails ) => Promise<void> {
  return async ( cfd ) => {
    const fileName = fileNameFrom ( cfd );
    const target = targetFrom ( cfd )
    const fullname = fileName.includes ( '://' ) ? fileName : rootUrl + '/' + fileName
    const text = await fileOps.loadFileOrUrl ( fullname )
    const txformed: string = tx && isTemplateFileDetails ( cfd ) ? await tx ( cfd.type, text ) : text
    const postProcessed = postProcess ( `Post processing ${targetRoot}, ${JSON.stringify ( cfd )}`, cfd, txformed )
    return fileOps.saveFile ( targetRoot + '/' + target, postProcessed );
  }
}


export function copyFile ( fileOps: FileOps, d: DebugCommands, rootUrl: string, target: string ): ( fd: CopyFileDetails ) => Promise<void> {
  return copyFileAndTransform ( fileOps, d, rootUrl, target, undefined )
}
export function copyFiles ( context: string, fileOps: FileOps, d: DebugCommands, rootUrl: string, target: string, tx?: ( type: string, text: string ) => Promise<string> ): ( fs: CopyFileDetails[] ) => Promise<void> {
  const cf = copyFileAndTransform ( fileOps, d, rootUrl, target, tx )
  return fs => Promise.all ( fs.map ( f => cf ( f ).catch ( e => {
    console.error ( e );
    throw Error ( `Error ${context}\nFile ${JSON.stringify ( f )}\n${e}` )
  } ) ) ).then ( () => {} )
}
