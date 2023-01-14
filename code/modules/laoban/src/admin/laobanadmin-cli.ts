#!/usr/bin/env node
//Copyright (c)2020-2023 Philip Rice. <br />Permission is hereby granted, free of charge, to any person obtaining a copyof this software and associated documentation files (the Software), to dealin the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:  <br />The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED AS
import { LaobanAdmin } from "./laoban-admin";
import { fileOpsNode } from "@laoban/filesops-node";
import { shortCutFileOps, shortCuts } from "@laoban/fileops";


try {
  const admin = new LaobanAdmin ( shortCutFileOps(fileOpsNode(), shortCuts), process.cwd (),process.env, process.argv )
  admin.start ()
} catch ( e ) {
  console.error ( e.message )
}