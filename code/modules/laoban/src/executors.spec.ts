//Copyright (c)2020-2023 Philip Rice. <br />Permission is hereby granted, free of charge, to any person obtaining a copyof this software and associated documentation files (the Software), to dealin the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:  <br />The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED AS
import path from "path";


export function streamNamefn(sessionDir: string, sessionId: string, scriptName: string, directory: string) {
  return path.join(sessionDir,
    sessionId,
    directory.replace(/\//g, '_')) + '.' + scriptName + '.log'
}
describe("streamNamefn", () =>{
  it ("should", () =>{

  })
})