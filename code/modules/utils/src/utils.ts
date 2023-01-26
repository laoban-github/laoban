//Copyright (c)2020-2023 Philip Rice. <br />Permission is hereby granted, free of charge, to any person obtaining a copyof this software and associated documentation files (the Software), to dealin the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:  <br />The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED AS
import { safeArray } from "./safe";

export function unique<T> ( ts: T[] | undefined, tagFn: ( t: T ) => string ): T[] {
  const alreadyIn: Set<string> = new Set ()
  var result: T[] = []
  safeArray ( ts ).forEach ( t => {
    const tag = tagFn ( t );
    if ( !alreadyIn.has ( tag ) ) {
      result.push ( t );
      alreadyIn.add ( tag )
    }
  } )
  return result
}


export const chain = <From, To> ( ...fns: (( from: From ) => To | undefined)[] ): ( from: From ) => To | undefined => ( from: From ) => {
  for ( let fn of fns ) {
    let result = fn ( from )
    if ( result !== undefined ) return result
  }
  return undefined
}

export function flatten<T> ( t: T[][] ): T[] {
  return ([] as T[]).concat ( ...t )
}

export function flatMap<From, To> ( ts: From[], fn: ( from: From ) => To[] ): To[] {
  return flatten ( ts.map ( fn ) )
}

export function foldK<Acc, V> ( vs: V[], zero: Acc, foldFn: ( acc: Acc, v: V ) => Promise<Acc> ): Promise<Acc> {
  return vs.reduce ( async ( accP, v ) => accP.then ( acc => foldFn ( acc, v ) ), Promise.resolve ( zero ) )
}

export function mapK<V, To> ( vs: V[], fn: ( v: V ) => Promise<To> ): Promise<To[]> {
  return Promise.all<To> ( vs.map ( fn ) )
}